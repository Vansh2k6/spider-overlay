import { FX, SILK } from "../../config/fx.js";

// Every buffer is allocated at engine creation; slots are reused after a visible fade.
export function createRopes(slots = Math.floor(SILK.maxNodes / SILK.nodesPerRope)) {
  const maxNodes = slots * SILK.nodesPerRope;
  return {
    slots, x: new Float64Array(maxNodes), y: new Float64Array(maxNodes),
    px: new Float64Array(maxNodes), py: new Float64Array(maxNodes),
    fiber: new Float64Array(maxNodes * 2),
    state: new Uint8Array(slots), asleep: new Uint8Array(slots),
    opacity: new Float64Array(slots), birth: new Float64Array(slots),
    quiet: new Float64Array(slots), pinX: new Float64Array(slots), pinY: new Float64Array(slots),
    pins: new Uint8Array(slots), kind: new Uint8Array(slots), rest: new Float64Array(slots),
    nodes: 0, serial: 0, fades: 0, accumulator: 0, active: false,
  };
}
export type Ropes = ReturnType<typeof createRopes>;

// Capacity pauses admission and preserves every existing strand.
export function requestRope(r: Ropes, x: number, y: number, heading: number) {
  let slot = -1;
  for (let s = 0; s < r.slots; s++) if (!r.state[s]) { slot = s; break; }
  if (slot < 0) return -1;
  r.state[slot] = 1; r.asleep[slot] = 0; r.opacity[slot] = 1;
  r.birth[slot] = ++r.serial; r.quiet[slot] = 0;
  r.pinX[slot] = x; r.pinY[slot] = y;
  r.pins[slot] = 1; r.kind[slot] = 0; r.rest[slot] = SILK.restLength;
  const start = slot * SILK.nodesPerRope;
  for (let i = 0; i < SILK.nodesPerRope; i++) {
    const n = start + i, wave = Math.sin(i * SILK.fiberFrequency + r.serial * SILK.fiberSeed);
    r.x[n] = x - Math.cos(heading) * SILK.restLength * i;
    r.y[n] = y - Math.sin(heading) * SILK.restLength * i;
    r.px[n] = r.x[n] + Math.sin(heading) * wave * SILK.creationImpulse;
    r.py[n] = r.y[n] - Math.cos(heading) * wave * SILK.creationImpulse;
    r.fiber[n * 2] = i ? wave * SILK.fiberSpread : 0;
    r.fiber[n * 2 + 1] = i ? Math.sin(i * SILK.fiberFrequency - r.serial * SILK.fiberSeed) * SILK.fiberSpread : 0;
  }
  r.nodes += SILK.nodesPerRope; r.active = true;
  return slot;
}

export function pinRope(r: Ropes, slot: number, x: number, y: number) {
  if (slot < 0 || !r.state[slot]) return;
  if (Math.hypot(x - r.pinX[slot], y - r.pinY[slot]) > SILK.pinEpsilon) {
    r.asleep[slot] = 0; r.quiet[slot] = 0; r.active = true;
  }
  r.pinX[slot] = x; r.pinY[slot] = y;
  const n = slot * SILK.nodesPerRope;
  r.x[n] = r.px[n] = x; r.y[n] = r.py[n] = y;
}

export function pinRopeEnd(r: Ropes, slot: number, x: number, y: number) {
  if (slot < 0 || !r.state[slot]) return;
  const n = (slot + 1) * SILK.nodesPerRope - 1;
  if (Math.hypot(x - r.x[n], y - r.y[n]) > SILK.pinEpsilon) {
    r.asleep[slot] = 0; r.quiet[slot] = 0; r.active = true;
  }
  r.x[n] = r.px[n] = x; r.y[n] = r.py[n] = y;
}

export function releaseRope(r: Ropes, slot: number) {
  if (!r.state[slot]) return;
  r.pins[slot] = 0; r.state[slot] = 2; r.asleep[slot] = 0;
  r.quiet[slot] = 0; r.active = true;
}

function constrain(r: Ropes, slot: number, reverse: boolean) {
  const start = slot * SILK.nodesPerRope, end = start + SILK.nodesPerRope - 1;
  for (let j = 1; j < SILK.nodesPerRope; j++) {
    const b = start + (reverse ? SILK.nodesPerRope - j : j), a = b - 1;
    const dx = r.x[b] - r.x[a], dy = r.y[b] - r.y[a];
    const distance = Math.hypot(dx, dy);
    if (distance <= FX.directionEpsilon) continue;
    const fixedA = a === start && !!(r.pins[slot] & 1);
    const fixedB = b === end && !!(r.pins[slot] & 2);
    const correction = (distance - r.rest[slot]) / distance;
    const weight = fixedA || fixedB ? 1 : 0.5;
    if (!fixedB) { r.x[b] -= dx * correction * weight; r.y[b] -= dy * correction * weight; }
    if (!fixedA) { r.x[a] += dx * correction * weight; r.y[a] += dy * correction * weight; }
  }
}

function integrate(r: Ropes, slot: number, bodyX: number, bodyY: number, vx: number, vy: number) {
  const start = slot * SILK.nodesPerRope, end = start + SILK.nodesPerRope;
  const damping = Math.exp(-SILK.damping * SILK.fixedDt);
  let maxSpeed = 0;
  for (let n = start; n < end; n++) {
    if ((n === start && (r.pins[slot] & 1)) || (n === end - 1 && (r.pins[slot] & 2))) continue;
    let dx = (r.x[n] - r.px[n]) * damping, dy = (r.y[n] - r.py[n]) * damping;
    const proximity = Math.max(0, 1 - Math.hypot(r.x[n] - bodyX, r.y[n] - bodyY) / SILK.impulseRadius);
    dx += vx * proximity * SILK.impulseGain * SILK.fixedDt * SILK.fixedDt;
    dy += vy * proximity * SILK.impulseGain * SILK.fixedDt * SILK.fixedDt;
    r.px[n] = r.x[n]; r.py[n] = r.y[n];
    r.x[n] += dx; r.y[n] += dy + SILK.gravity * SILK.fixedDt * SILK.fixedDt;
  }
  for (let iteration = 0; iteration < SILK.iterations; iteration++) {
    constrain(r, slot, false); constrain(r, slot, true);
  }
  for (let n = start + 1; n < end; n++) {
    maxSpeed = Math.max(maxSpeed, Math.hypot(r.x[n] - r.px[n], r.y[n] - r.py[n]) / SILK.fixedDt);
  }
  r.quiet[slot] = maxSpeed < SILK.settleSpeed ? r.quiet[slot] + SILK.fixedDt : 0;
  if (r.quiet[slot] >= SILK.settleDelay) {
    r.asleep[slot] = 1;
    for (let n = start; n < end; n++) { r.px[n] = r.x[n]; r.py[n] = r.y[n]; }
  }
}

export function stepRopes(r: Ropes, dt: number, bodyX: number, bodyY: number, vx: number, vy: number) {
  r.accumulator += Math.min(dt, FX.maxDt);
  while (r.accumulator + Number.EPSILON >= SILK.fixedDt) {
    r.accumulator = Math.max(0, r.accumulator - SILK.fixedDt);
    for (let s = 0; s < r.slots; s++) {
      if (!r.state[s]) continue;
      if (r.state[s] === 2) {
        r.opacity[s] = Math.max(0, r.opacity[s] - SILK.fixedDt / SILK.fadeDuration);
        if (!r.opacity[s]) { r.state[s] = 0; r.nodes -= SILK.nodesPerRope; continue; }
      }
      if (!r.asleep[s]) integrate(r, s, bodyX, bodyY, vx, vy);
    }
  }
  r.active = false;
  for (let s = 0; s < r.slots; s++) {
    if (r.state[s] && (!r.asleep[s] || r.state[s] === 2)) r.active = true;
  }
}
