import { FRONT_OFFSET, LEGS } from "../../config/fx.js";
import type { Spider } from "./spider.js";

export function createLegs() {
  return {
    hipX: new Float64Array(LEGS.count), hipY: new Float64Array(LEGS.count),
    kneeX: new Float64Array(LEGS.count), kneeY: new Float64Array(LEGS.count),
    footX: new Float64Array(LEGS.count), footY: new Float64Array(LEGS.count),
    startX: new Float64Array(LEGS.count), startY: new Float64Array(LEGS.count),
    targetX: new Float64Array(LEGS.count), targetY: new Float64Array(LEGS.count),
    liftX: new Float64Array(LEGS.count), liftY: new Float64Array(LEGS.count),
    error: new Float64Array(LEGS.count), swing: new Uint8Array(LEGS.count),
    bodyX: 0, bodyY: 0, heading: 0, ready: false,
    activeGroup: -1, nextGroup: 0, phase: 0, bob: 0, steps: 0, corrections: 0,
    duration: LEGS.stepDuration as number,
  };
}
export type Legs = ReturnType<typeof createLegs>;

export function legGroup(index: number) {
  return index < LEGS.perSide ? index % 2 : 1 - index % 2;
}

// Keep the sign of the knee's cross product fixed, including near full extension.
export function solveLeg(legs: Legs, index: number, hipX: number, hipY: number, x: number, y: number) {
  const side = index < LEGS.perSide ? -1 : 1;
  const row = index % LEGS.perSide, bend = side * LEGS.kneeBend[row];
  const upper = LEGS.upperLength[row], lower = LEGS.lowerLength[row];
  let dx = x - hipX, dy = y - hipY;
  const distance = Math.hypot(dx, dy);
  const reach = Math.max(Math.abs(upper - lower) + LEGS.reachEpsilon,
    Math.min(upper + lower - LEGS.reachEpsilon, distance));
  if (distance > LEGS.reachEpsilon) { dx /= distance; dy /= distance; }
  else { dx = side; dy = 0; }
  const along = (reach * reach + upper * upper - lower * lower) / (2 * reach);
  const outward = Math.sqrt(Math.max(0, upper * upper - along * along));
  legs.hipX[index] = hipX; legs.hipY[index] = hipY;
  legs.kneeX[index] = hipX + dx * along - bend * dy * outward;
  legs.kneeY[index] = hipY + dy * along + bend * dx * outward;
  // Preserve a reachable planted foot bit-for-bit; project only unreachable swing targets.
  legs.footX[index] = distance === reach ? x : hipX + dx * reach;
  legs.footY[index] = distance === reach ? y : hipY + dy * reach;
}

export function resetLegs(legs: Legs, spider: Spider) {
  const angle = spider.heading + FRONT_OFFSET, c = Math.cos(angle), s = Math.sin(angle);
  for (let i = 0; i < LEGS.count; i++) {
    const row = i % LEGS.perSide, side = i < LEGS.perSide ? -1 : 1;
    solveLeg(legs, i, spider.x + c * side * LEGS.hipX[row] - s * LEGS.hipY[row],
      spider.y + s * side * LEGS.hipX[row] + c * LEGS.hipY[row],
      spider.x + c * side * LEGS.homeX[row] - s * LEGS.homeY[row],
      spider.y + s * side * LEGS.homeX[row] + c * LEGS.homeY[row]);
  }
  legs.bodyX = spider.x; legs.bodyY = spider.y; legs.heading = spider.heading;
  legs.swing.fill(0);
  legs.activeGroup = -1; legs.phase = legs.bob = 0; legs.ready = true;
}

function supported(legs: Legs, x: number, y: number, heading: number) {
  const c = Math.cos(heading + FRONT_OFFSET), s = Math.sin(heading + FRONT_OFFSET);
  for (let i = 0; i < LEGS.count; i++) {
    if (legs.swing[i]) continue;
    const row = i % LEGS.perSide, side = i < LEGS.perSide ? -1 : 1;
    const min = Math.abs(LEGS.upperLength[row] - LEGS.lowerLength[row]) + LEGS.reachEpsilon;
    const max = LEGS.upperLength[row] + LEGS.lowerLength[row] - LEGS.reachEpsilon;
    const dx = legs.footX[i] - x - c * side * LEGS.hipX[row] + s * LEGS.hipY[row];
    const dy = legs.footY[i] - y - s * side * LEGS.hipX[row] - c * LEGS.hipY[row];
    const squared = dx * dx + dy * dy;
    if (squared > max * max + LEGS.supportTolerance || squared < min * min - LEGS.supportTolerance) return false;
  }
  return true;
}

function supportBody(legs: Legs, spider: Spider, dt: number) {
  const dx = spider.x - legs.bodyX, dy = spider.y - legs.bodyY;
  const turn = Math.atan2(Math.sin(spider.heading - legs.heading), Math.cos(spider.heading - legs.heading));
  if (!supported(legs, spider.x, spider.y, legs.heading + turn)) {
    // Scale the whole pose change, rather than dragging grounded feet or stretching bones.
    let low = 0, high = 1;
    for (let j = 0; j < LEGS.supportIterations; j++) {
      const mid = (low + high) / 2;
      if (supported(legs, legs.bodyX + dx * mid, legs.bodyY + dy * mid, legs.heading + turn * mid)) low = mid;
      else high = mid;
    }
    spider.x = legs.bodyX + dx * low; spider.y = legs.bodyY + dy * low;
    spider.heading = legs.heading + turn * low;
    spider.vx = (spider.x - legs.bodyX) / dt; spider.vy = (spider.y - legs.bodyY) / dt;
  }
}

export function stepLegs(legs: Legs, spider: Spider, dt: number) {
  if (!legs.ready) resetLegs(legs, spider);
  // Anticipate pursuit velocity even when grounded feet limit this frame's body travel.
  const desiredVX = spider.vx, desiredVY = spider.vy;
  const desiredX = spider.x, desiredY = spider.y, desiredHeading = spider.heading;
  supportBody(legs, spider, dt);
  const c = Math.cos(spider.heading + FRONT_OFFSET), s = Math.sin(spider.heading + FRONT_OFFSET);
  if (legs.activeGroup < 0 && spider.moving) {
    const speed = Math.hypot(desiredVX, desiredVY);
    const lead = speed > 0 ? Math.min(LEGS.leadTime, LEGS.maxLead / speed) : 0;
    const leadX = desiredVX * lead, leadY = desiredVY * lead;
    const turn = Math.atan2(Math.sin(desiredHeading - spider.heading), Math.cos(desiredHeading - spider.heading));
    const goalHeading = spider.heading + Math.max(-LEGS.turnLead, Math.min(LEGS.turnLead, turn));
    const goalC = Math.cos(goalHeading + FRONT_OFFSET), goalS = Math.sin(goalHeading + FRONT_OFFSET);
    let error = 0, otherError = 0;
    for (let i = 0; i < LEGS.count; i++) {
      const row = i % LEGS.perSide, side = i < LEGS.perSide ? -1 : 1;
      legs.error[i] = Math.hypot(desiredX + goalC * side * LEGS.homeX[row] - goalS * LEGS.homeY[row] + leadX - legs.footX[i],
        desiredY + goalS * side * LEGS.homeX[row] + goalC * LEGS.homeY[row] + leadY - legs.footY[i]);
      if (legGroup(i) === legs.nextGroup) error = Math.max(error, legs.error[i]);
      else otherError = Math.max(otherError, legs.error[i]);
    }
    // The reference also permits corrective steps under reach pressure. Keep the other
    // tetrapod grounded, but avoid waiting on a group whose feet already meet their goals.
    if (error <= LEGS.stepThreshold && otherError > LEGS.stepThreshold
      && Math.hypot(spider.vx, spider.vy) < LEGS.blockedSpeed) {
      legs.nextGroup = 1 - legs.nextGroup; error = otherError; legs.corrections++;
    }
    if (error > LEGS.stepThreshold) {
      legs.activeGroup = legs.nextGroup; legs.nextGroup = 1 - legs.nextGroup;
      legs.duration = Math.max(LEGS.minStepDuration, LEGS.stepDuration - speed / LEGS.cadenceSpeed);
      legs.phase = 0; legs.steps++;
      for (let i = 0; i < LEGS.count; i++) {
        if (legGroup(i) !== legs.activeGroup) continue;
        if (legs.error[i] <= LEGS.stepThreshold) continue;
        legs.swing[i] = 1;
        const row = i % LEGS.perSide, side = i < LEGS.perSide ? -1 : 1;
        legs.startX[i] = legs.footX[i]; legs.startY[i] = legs.footY[i];
        legs.liftX[i] = c * side * LEGS.stepLift; legs.liftY[i] = s * side * LEGS.stepLift;
        legs.targetX[i] = desiredX + goalC * side * LEGS.homeX[row] - goalS * LEGS.homeY[row] + leadX;
        legs.targetY[i] = desiredY + goalS * side * LEGS.homeX[row] + goalC * LEGS.homeY[row] + leadY;
      }
    }
  }
  if (legs.activeGroup >= 0) legs.phase = Math.min(1, legs.phase + dt / legs.duration);
  const p = legs.phase, ease = p * p * (3 - 2 * p);
  const lift = legs.activeGroup >= 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
  for (let i = 0; i < LEGS.count; i++) {
    const row = i % LEGS.perSide, side = i < LEGS.perSide ? -1 : 1;
    let x = legs.footX[i], y = legs.footY[i];
    if (legs.swing[i]) {
      x = legs.startX[i] + (legs.targetX[i] - legs.startX[i]) * ease + legs.liftX[i] * lift;
      y = legs.startY[i] + (legs.targetY[i] - legs.startY[i]) * ease + legs.liftY[i] * lift;
    }
    const hx = spider.x + c * side * LEGS.hipX[row] - s * LEGS.hipY[row];
    const hy = spider.y + s * side * LEGS.hipX[row] + c * LEGS.hipY[row];
    if (legs.swing[i]) {
      // Leave room for the next body pose instead of landing on an IK singularity.
      const dx = x - hx, dy = y - hy, distance = Math.hypot(dx, dy);
      const margin = LEGS.landingMargin * ease;
      const min = Math.abs(LEGS.upperLength[row] - LEGS.lowerLength[row]) + LEGS.reachEpsilon + margin;
      const max = LEGS.upperLength[row] + LEGS.lowerLength[row] - LEGS.reachEpsilon - margin;
      const reach = Math.max(min, Math.min(max, distance));
      if (distance > LEGS.reachEpsilon) { x = hx + dx / distance * reach; y = hy + dy / distance * reach; }
    }
    solveLeg(legs, i, hx, hy, x, y);
  }
  legs.bob = lift * LEGS.abdomenBob;
  if (p >= 1) { legs.activeGroup = -1; legs.swing.fill(0); }
  legs.bodyX = spider.x; legs.bodyY = spider.y; legs.heading = spider.heading;
}
