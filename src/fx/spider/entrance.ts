import { SPIDER_ENTRANCE as C, SILK } from "../../config/fx.js";
import { pointer, releaseVirtualPointer, setVirtualPointer } from "../input.js";
import { createIntroTimeline } from "../intro/introTimeline.js";
import type { Spider } from "./spider.js";
import { createRopes, requestRope } from "../silk/rope.js";
import { drawRopes } from "../silk/draw.js";
import { createDew } from "../silk/dew.js";

// The desktop gate may unmount the canvas without loading a new document.
let playedThisLoad = false;

export function createEntrance(reduced: boolean) {
  const skip = reduced || playedThisLoad;
  const motion = { descent: 0, fall: 0 };
  const timeline = skip ? null : createIntroTimeline(motion);
  const rope = createRopes(1);
  const dew = createDew(rope);
  let drawnAt = 0;
  requestRope(rope, 0, 0, 0);
  rope.kind[0] = 1;
  rope.fiber[(SILK.nodesPerRope - 1) * 2] = 0;
  rope.fiber[(SILK.nodesPerRope - 1) * 2 + 1] = 0;
  const state = { active: !skip, elapsed: 0, fall: skip ? 1 : 0,
    x: 0, endY: 0, scale: 1, ropeX: 0, ropeY: 0 };
  function resize(spider: Spider, width: number, height: number, scale: number) {
    state.x = width * C.xFraction;
    state.endY = Math.max(C.minY, Math.min(C.maxY, height * C.yFraction));
    state.scale = scale;
    spider.x = state.x / scale;
    spider.y = (C.startY + (state.endY - C.startY) * motion.descent) / scale;
    spider.heading = C.heading; spider.ready = true;
    setVirtualPointer(state.x, spider.y * scale);
  }
  function advance(spider: Spider, dt: number) {
    if (!timeline || state.fall >= 1) return;
    playedThisLoad = true;
    state.elapsed += dt;
    timeline.advance(state.elapsed);
    state.fall = motion.fall;
    if (!state.active) return;
    setVirtualPointer(state.x, C.startY + (state.endY - C.startY) * motion.descent);
    const y = pointer.y / state.scale;
    spider.vy = (y - spider.y) / dt;
    spider.moving = state.elapsed < C.duration;
    spider.y = y; spider.x = pointer.x / state.scale;
    if (state.elapsed >= C.duration + C.pause) {
      state.fall = 1;
      state.active = false; spider.moving = false; spider.vy = 0;
      releaseVirtualPointer();
    }
  }
  function draw(ctx: CanvasRenderingContext2D, spinneretX: number, spinneretY: number, scale: number) {
    if (state.fall >= 1) return;
    if (state.active) { state.ropeX = spinneretX; state.ropeY = spinneretY; }
    const drop = C.fallDistance * state.fall * state.fall;
    for (let i = 0; i < SILK.nodesPerRope; i++) {
      const t = i / (SILK.nodesPerRope - 1);
      rope.x[i] = state.x + (state.ropeX - state.x) * t;
      rope.y[i] = drop + state.ropeY * t;
    }
    rope.opacity[0] = 1 - state.fall;
    rope.rest[0] = Math.hypot(state.ropeX - state.x, state.ropeY) / (SILK.nodesPerRope - 1);
    dew.step(Math.min(0.05, state.elapsed - drawnAt));
    drawnAt = state.elapsed;
    drawRopes(ctx, rope, scale);
    ctx.save(); ctx.scale(1 / scale, 1 / scale);
    dew.drawBeads(ctx); dew.drawDrips(ctx); ctx.restore();
  }
  function dispose() { timeline?.dispose(); if (state.active) releaseVirtualPointer(); }
  function releasePointer() { if (state.active) releaseVirtualPointer(); }
  return { state, resize, advance, draw, releasePointer, dispose };
}
