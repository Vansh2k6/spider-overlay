import { WET } from "../../config/wet.js";
import { SILK } from "../../config/fx.js";
import type { Ropes } from "./rope.js";
import type { Orbs } from "./orbs.js";

function beadSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = WET.spriteSize;
  const ctx = c.getContext("2d")!;
  const r = c.width / 2;
  const g = ctx.createRadialGradient(r * 0.65, r * 0.55, 0, r, r, r);
  g.addColorStop(0, WET.beadHighlight); g.addColorStop(0.22, WET.beadTint);
  g.addColorStop(0.48, "rgba(93,139,180,0.24)"); g.addColorStop(0.8, "rgba(49,82,117,0.55)");
  g.addColorStop(0.94, WET.beadTint); g.addColorStop(1, "transparent");
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export function createDew(r: Ropes, o?: Orbs) {
  const sprite = beadSprite();
  const owner = new Int16Array(WET.beadCap).fill(-1);
  const t = new Float32Array(owner.length), radius = new Float32Array(owner.length);
  const perOwner = new Uint16Array(r.slots + (o ? WET.orbCap : 0));
  const source = new Int16Array(WET.dripCap).fill(-1);
  const slide = new Float64Array(source.length), age = new Float64Array(source.length);
  const dx = new Float64Array(source.length), dy = new Float64Array(source.length);
  const clearFade = new Float64Array(source.length).fill(1);
  const state = { beads: 0, drips: 0, beadCapReached: false, dripCapReached: false, spawned: 0 };
  let timer = 0, serial = 0, cursor = 0, px = 0, py = 0;
  function alpha(id: number) { return id < r.slots ? r.opacity[id] * Number(!!r.state[id]) : o!.opacity[id - r.slots]; }
  function sample(id: number, at: number) {
    const orb = id >= r.slots, count = orb ? WET.orbNodes : SILK.nodesPerRope;
    const first = orb ? WET.spokes + 1 : 0;
    const f = first + Math.max(0, Math.min(1, at)) * (count - 1 - first);
    const i = Math.min(count - 2, Math.floor(f)), mix = f - i;
    const a = (orb ? id - r.slots : id) * count + i;
    const xs = orb ? o!.x : r.x, ys = orb ? o!.y : r.y;
    px = xs[a] + (xs[a + 1] - xs[a]) * mix;
    py = ys[a] + (ys[a + 1] - ys[a]) * mix + (orb ? o!.offset(id - r.slots) : 0);
    if (orb) py += 2 * mix * (1 - mix) * Math.abs(xs[a + 1] - xs[a]) * WET.spiralSag;
  }
  function spawn(bead: number) {
    if (owner[bead] < 0) return;
    const i = source.indexOf(-1);
    if (i < 0) { state.dripCapReached = true; return; }
    source[i] = owner[bead]; slide[i] = t[bead]; age[i] = 0; clearFade[i] = 1;
    sample(source[i], slide[i]); dx[i] = px; dy[i] = py;
    state.drips++; state.spawned++;
  }
  function step(dt: number) {
    for (let i = 0; i < owner.length; i++) {
      const id = owner[i];
      if (id >= 0 && !alpha(id)) { owner[i] = -1; perOwner[id]--; state.beads--; }
    }
    state.beadCapReached = false;
    for (let id = 0; id < perOwner.length; id++) {
      if (alpha(id) < 1) continue;
      const wanted = id < r.slots ? Math.floor(r.rest[id] * (SILK.nodesPerRope - 1) / WET.beadSpacing) : WET.spokes * 2;
      while (perOwner[id] < wanted) {
        if (state.beads === owner.length) { state.beadCapReached = true; break; }
        const i = owner.indexOf(-1), k = ++perOwner[id];
        owner[i] = id; t[i] = (k * 0.61803398875 + id * 0.37) % 1;
        radius[i] = WET.beadMin + (WET.beadMax - WET.beadMin) * ((++serial * 0.754877666) % 1) ** 2;
        state.beads++;
      }
    }
    timer += dt;
    if (timer >= Math.max(WET.minDripInterval, WET.dripInterval / Math.sqrt(state.beads)) && state.beads) {
      timer = 0;
      for (let n = 0; n < owner.length; n++) {
        cursor = (cursor + 1) % owner.length;
        if (owner[cursor] >= 0 && alpha(owner[cursor]) === 1) { spawn(cursor); break; }
      }
    }
    for (let i = 0; i < source.length; i++) {
      const id = source[i]; if (id < 0) continue;
      age[i] += dt;
      if (clearFade[i] < 1) clearFade[i] = Math.max(0, clearFade[i] - dt / SILK.fadeDuration);
      if (age[i] >= WET.dripLifetime || clearFade[i] === 0) { source[i] = -1; state.drips--; continue; }
      if (age[i] < WET.slideDuration && alpha(id) === 1) {
        const at = slide[i]; sample(id, at); const y0 = py, x0 = px;
        const epsilon = 0.001; sample(id, at + epsilon);
        slide[i] = Math.max(0, Math.min(1, at + Math.sign(py - y0) * WET.slideSpeed * dt * epsilon / Math.max(epsilon, Math.hypot(px - x0, py - y0))));
        sample(id, slide[i]); dx[i] = px; dy[i] = py;
      } else dy[i] += WET.dripGravity * Math.max(dt, age[i] - WET.slideDuration) * dt;
    }
  }
  function clear() {
    for (let i = 0; i < source.length; i++) if (source[i] >= 0 && clearFade[i] === 1) clearFade[i] = 1 - Number.EPSILON;
    state.dripCapReached = false;
  }
  function drawBeads(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < owner.length; i++) {
      const id = owner[i]; if (id < 0) continue;
      sample(id, t[i]); const size = radius[i];
      ctx.globalAlpha = WET.beadAlpha * alpha(id);
      ctx.drawImage(sprite, px - size, py - size * 0.35, size * 2, size * 2);
    }
  }
  function drawDrips(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < source.length; i++) if (source[i] >= 0) {
      ctx.globalAlpha = WET.beadAlpha * clearFade[i];
      ctx.drawImage(sprite, dx[i] - WET.beadMax, dy[i], WET.beadMax * 2, WET.dripLength);
    }
  }
  return { state, step, clear, drawBeads, drawDrips };
}
