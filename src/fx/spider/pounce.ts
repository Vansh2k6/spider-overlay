import { FRONT_OFFSET, FX, LEGS, SPIDER_POUNCE } from "../../config/fx.js";
import { solveLeg } from "./legs.js";
import type { Legs } from "./legs.js";
import { stopSpider } from "./spider.js";
import type { Spider } from "./spider.js";

export function createPounce() {
  return { active: false, elapsed: 0, duration: 0, progress: 0, height: 0,
    fromX: 0, fromY: 0, toX: 0, toY: 0, targetX: 0, targetY: 0,
    fromHeading: 0, turn: 0, fromBob: 0, started: 0, landed: 0, cancelled: 0,
    footX: new Float64Array(LEGS.count), footY: new Float64Array(LEGS.count) };
}
export type Pounce = ReturnType<typeof createPounce>;

export function beginPounce(p: Pounce, spider: Spider, legs: Legs, x: number, y: number) {
  const dx = x - spider.x, dy = y - spider.y, distance = Math.hypot(dx, dy);
  // A close click keeps ordinary repulsion/arrival; never teleport out of the cursor circle.
  if (distance <= FX.stopRadius + FX.resumeDistance) {
    if (p.active) {
      p.active = false; p.cancelled++; legs.swing.fill(0);
      stopSpider(spider); spider.mode = "walk";
    }
    return false;
  }
  const travel = Math.min(SPIDER_POUNCE.maxDistance, distance - FX.stopRadius);
  p.fromX = spider.x; p.fromY = spider.y; p.fromHeading = spider.heading;
  p.toX = spider.x + dx / distance * travel; p.toY = spider.y + dy / distance * travel;
  p.targetX = x; p.targetY = y;
  p.turn = Math.atan2(Math.sin(Math.atan2(dy, dx) - spider.heading), Math.cos(Math.atan2(dy, dx) - spider.heading));
  p.duration = Math.max(SPIDER_POUNCE.minDuration, Math.min(SPIDER_POUNCE.maxDuration, travel / SPIDER_POUNCE.speed));
  p.height = Math.max(0, Math.min(SPIDER_POUNCE.height, Math.min(spider.y, p.toY) - SPIDER_POUNCE.edgeMargin));
  p.elapsed = p.progress = 0; p.fromBob = legs.bob;
  const c = Math.cos(spider.heading + FRONT_OFFSET), s = Math.sin(spider.heading + FRONT_OFFSET);
  for (let i = 0; i < LEGS.count; i++) {
    const fx = legs.footX[i] - spider.x, fy = legs.footY[i] - spider.y;
    p.footX[i] = c * fx + s * fy; p.footY[i] = -s * fx + c * fy;
  }
  legs.activeGroup = -1; legs.phase = 0; legs.swing.fill(1);
  if (p.active) p.cancelled++;
  p.active = true; p.started++; spider.mode = "pounce"; spider.moving = true;
  return true;
}

function flightLegs(p: Pounce, spider: Spider, legs: Legs, ease: number, arc: number) {
  const c = Math.cos(spider.heading + FRONT_OFFSET), s = Math.sin(spider.heading + FRONT_OFFSET);
  const fold = 1 - SPIDER_POUNCE.fold * arc;
  for (let i = 0; i < LEGS.count; i++) {
    const row = i % LEGS.perSide, side = i < LEGS.perSide ? -1 : 1;
    const hx = side * LEGS.hipX[row], hy = LEGS.hipY[row];
    const localX = hx + (p.footX[i] + (side * LEGS.homeX[row] - p.footX[i]) * ease - hx) * fold;
    const localY = hy + (p.footY[i] + (LEGS.homeY[row] - p.footY[i]) * ease - hy) * fold;
    solveLeg(legs, i, spider.x + c * hx - s * hy, spider.y + s * hx + c * hy,
      spider.x + c * localX - s * localY, spider.y + s * localX + c * localY);
  }
  legs.bob = p.fromBob * (1 - ease);
  legs.bodyX = spider.x; legs.bodyY = spider.y; legs.heading = spider.heading;
}

export function stepPounce(p: Pounce, spider: Spider, legs: Legs, dt: number) {
  if (!p.active) return;
  p.elapsed = Math.min(p.duration, p.elapsed + Math.min(dt, FX.maxDt));
  const t = p.elapsed / p.duration, ease = t * t * (3 - 2 * t);
  // The actual body and IK pose follow the arc, so hips and spinneret never separate.
  const arc = Math.sin(t * Math.PI), oldX = spider.x, oldY = spider.y;
  let x = p.fromX + (p.toX - p.fromX) * ease;
  let y = p.fromY + (p.toY - p.fromY) * ease - p.height * arc;
  const dx = x - p.targetX, dy = y - p.targetY, distance = Math.hypot(dx, dy);
  if (distance < FX.stopRadius) {
    const fallback = Math.hypot(p.fromX - p.targetX, p.fromY - p.targetY);
    x = p.targetX + (distance > FX.directionEpsilon ? dx / distance : (p.fromX - p.targetX) / fallback) * FX.stopRadius;
    y = p.targetY + (distance > FX.directionEpsilon ? dy / distance : (p.fromY - p.targetY) / fallback) * FX.stopRadius;
  }
  spider.x = x; spider.y = y; spider.heading = p.fromHeading + p.turn * ease;
  spider.vx = (x - oldX) / dt; spider.vy = (y - oldY) / dt;
  spider.moving = true; spider.mode = "pounce"; p.progress = t;
  flightLegs(p, spider, legs, ease, arc);
  if (t >= 1) {
    p.active = false; p.landed++; legs.swing.fill(0);
    stopSpider(spider); spider.mode = "walk";
  }
}
