import { SILK } from "../../config/fx.js";
import type { Ropes } from "./rope.js";

function coordinate(r: Ropes, start: number, i: number, fiber: number, vertical: boolean) {
  const n = start + i;
  if (fiber < 0) return vertical ? r.y[n] : r.x[n];
  const a = start + Math.max(0, i - 1), b = start + Math.min(SILK.nodesPerRope - 1, i + 1);
  const dx = r.x[b] - r.x[a], dy = r.y[b] - r.y[a], length = Math.hypot(dx, dy) || 1;
  const offset = r.fiber[n * 2 + fiber];
  return vertical ? r.y[n] + dx / length * offset : r.x[n] - dy / length * offset;
}

function stroke(context: CanvasRenderingContext2D, r: Ropes, start: number, i: number, fiber: number) {
  const a = Math.max(0, i - 1), c = Math.min(SILK.nodesPerRope - 1, i + 1);
  // Shared node normals keep neighboring curves joined, including during sharp bends.
  const ax = coordinate(r, start, a, fiber, false), ay = coordinate(r, start, a, fiber, true);
  const bx = coordinate(r, start, i, fiber, false), by = coordinate(r, start, i, fiber, true);
  const cx = coordinate(r, start, c, fiber, false), cy = coordinate(r, start, c, fiber, true);
  context.beginPath();
  context.moveTo((ax + bx) / 2, (ay + by) / 2);
  context.quadraticCurveTo(bx, by, (bx + cx) / 2, (by + cy) / 2);
  context.stroke();
}

function pathStrand(context: CanvasRenderingContext2D, r: Ropes, start: number, fiber: number) {
  context.moveTo(coordinate(r, start, 0, fiber, false), coordinate(r, start, 0, fiber, true));
  for (let i = 0; i < SILK.nodesPerRope; i++) {
    const next = Math.min(SILK.nodesPerRope - 1, i + 1);
    const x = coordinate(r, start, i, fiber, false), y = coordinate(r, start, i, fiber, true);
    context.quadraticCurveTo(x, y, (x + coordinate(r, start, next, fiber, false)) / 2,
      (y + coordinate(r, start, next, fiber, true)) / 2);
  }
}
function strokeStrand(context: CanvasRenderingContext2D, r: Ropes, start: number, fiber: number) {
  context.beginPath(); pathStrand(context, r, start, fiber); context.stroke();
}

export function drawRopes(context: CanvasRenderingContext2D, r: Ropes, renderScale: number) {
  context.save();
  context.scale(1 / renderScale, 1 / renderScale);
  context.strokeStyle = SILK.color; context.lineCap = "round";
  for (let pass = 0; pass < 4; pass++) {
    context.lineWidth = pass === 0 ? SILK.glowWidth : pass === 1 ? SILK.width : SILK.fiberWidth;
    context.globalAlpha = pass === 0 ? SILK.glowAlpha : pass === 1 ? SILK.alpha : SILK.fiberAlpha;
    context.beginPath();
    for (let s = 0; s < r.slots; s++) if (r.state[s] === 1 && r.kind[s] && r.opacity[s] === 1)
      pathStrand(context, r, s * SILK.nodesPerRope, pass < 2 ? -1 : pass - 2);
    context.stroke();
  }
  for (let s = 0; s < r.slots; s++) {
    if (!r.state[s] || (r.state[s] === 1 && r.kind[s] && r.opacity[s] === 1)) continue;
    const start = s * SILK.nodesPerRope;
    // Anchored silk has uniform opacity: batch each continuous fiber into one stroke.
    if (r.kind[s]) {
      context.lineWidth = SILK.glowWidth; context.globalAlpha = r.opacity[s] * SILK.glowAlpha;
      strokeStrand(context, r, start, -1);
      context.lineWidth = SILK.width; context.globalAlpha = r.opacity[s] * SILK.alpha;
      strokeStrand(context, r, start, -1);
      context.lineWidth = SILK.fiberWidth; context.globalAlpha = r.opacity[s] * SILK.fiberAlpha;
      strokeStrand(context, r, start, 0); strokeStrand(context, r, start, 1);
      continue;
    }
    for (let i = 0; i < SILK.nodesPerRope; i++) {
      const alpha = r.opacity[s] * (r.kind[s] ? 1 : 1 - (1 - SILK.tailAlpha) * i / (SILK.nodesPerRope - 1));
      context.lineWidth = SILK.glowWidth; context.globalAlpha = alpha * SILK.glowAlpha;
      stroke(context, r, start, i, -1);
      context.lineWidth = SILK.width; context.globalAlpha = alpha * SILK.alpha;
      stroke(context, r, start, i, -1);
      context.lineWidth = SILK.fiberWidth; context.globalAlpha = alpha * SILK.fiberAlpha;
      stroke(context, r, start, i, 0); stroke(context, r, start, i, 1);
    }
  }
  context.restore();
}
