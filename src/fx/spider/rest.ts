import { SPIDER_REST } from "../../config/fx.js";

export function createRest() {
  return { blend: 0, closed: false, phase: 0, active: false, still: false,
    deadline: Infinity, pausedAt: -1, pairs: 0 };
}
export type Rest = ReturnType<typeof createRest>;

// Deadlines allow the shared loop to sleep between expressions, rather than spin at idle.
export function stepRest(r: Rest, still: boolean, dt: number, time: number) {
  const blend = r.blend, closed = r.closed;
  r.active = false;
  if (!still) {
    r.still = false; r.phase = 0; r.closed = false; r.deadline = Infinity;
    r.blend = Math.max(0, r.blend - dt / SPIDER_REST.fadeOut);
    r.active = r.blend > 0;
  } else {
    if (!r.still) { r.still = true; r.deadline = time + SPIDER_REST.idleDelay; }
    if (r.blend < 1) {
      if (time >= r.deadline) {
        r.blend = Math.min(1, r.blend + dt / SPIDER_REST.fadeIn);
        r.active = r.blend < 1;
        if (r.blend === 1) r.deadline = time + SPIDER_REST.repeatDelay;
      }
    } else {
      if (time >= r.deadline) {
        r.phase++;
        if (r.phase === 4) { r.phase = 0; r.pairs++; }
        r.closed = r.phase === 1 || r.phase === 3;
        r.deadline = time + (r.closed ? SPIDER_REST.closedDuration
          : r.phase === 2 ? SPIDER_REST.openGap : SPIDER_REST.repeatDelay);
      }
      r.active = r.phase !== 0;
    }
  }
  return blend !== r.blend || closed !== r.closed;
}

export function restVisibility(r: Rest, hidden: boolean, time: number) {
  if (hidden) {
    if (r.pausedAt < 0) r.pausedAt = time;
  } else if (r.pausedAt >= 0) {
    // Hidden time is not idle/blink time: resume the same frame without skipping a lid.
    r.deadline += time - r.pausedAt;
    r.pausedAt = -1;
  }
}
