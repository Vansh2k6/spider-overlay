import { LEGS, SPIDER_PALETTE } from "../../config/fx.js";
import type { Legs } from "./legs.js";

function bone(context: CanvasRenderingContext2D, x: number, y: number, endX: number, endY: number,
  width: number, endWidth: number) {
  const bands = SPIDER_PALETTE.length;
  const dx = endX - x, dy = endY - y, length = Math.hypot(dx, dy);
  const bow = width * LEGS.segmentCurve;
  const nx = -dy / length * bow, ny = dx / length * bow;
  context.globalAlpha = 1;
  for (let band = 0; band < bands; band++) {
    const from = band / bands, to = (band + 1) / bands;
    const startX = x + dx * from + 2 * nx * from * (1 - from);
    const startY = y + dy * from + 2 * ny * from * (1 - from);
    context.strokeStyle = SPIDER_PALETTE[band];
    context.lineWidth = width + (endWidth - width) * (from + to) / 2;
    context.beginPath();
    context.moveTo(startX, startY);
    // Subdivide one shallow quadratic so color bands share a continuous rounded limb.
    context.quadraticCurveTo(startX + (dx + 2 * nx * (1 - 2 * from)) * (to - from) / 2,
      startY + (dy + 2 * ny * (1 - 2 * from)) * (to - from) / 2,
      x + dx * to + 2 * nx * to * (1 - to), y + dy * to + 2 * ny * to * (1 - to));
    context.stroke();
  }
  // Fixed fringe positions soften the procedural legs without random shimmer or buffers.
  context.globalAlpha = LEGS.hairAlpha;
  context.lineWidth = LEGS.hairWidth;
  for (let hair = 0; hair < LEGS.hairPositions.length; hair++) {
    const t = LEGS.hairPositions[hair], halfWidth = (width + (endWidth - width) * t) / 2;
    const px = x + dx * t + 2 * nx * t * (1 - t);
    const py = y + dy * t + 2 * ny * t * (1 - t);
    const tangentX = dx + 2 * nx * (1 - 2 * t), tangentY = dy + 2 * ny * (1 - 2 * t);
    const tangentLength = Math.hypot(tangentX, tangentY);
    const normalX = -tangentY / tangentLength, normalY = tangentX / tangentLength;
    context.strokeStyle = SPIDER_PALETTE[Math.floor(t * bands)];
    for (let side = -1; side <= 1; side += 2) {
      context.beginPath();
      context.moveTo(px + normalX * halfWidth * side, py + normalY * halfWidth * side);
      context.lineTo(px + normalX * (halfWidth + LEGS.hairLengths[hair]) * side,
        py + normalY * (halfWidth + LEGS.hairLengths[hair]) * side);
      context.stroke();
    }
  }
  context.globalAlpha = 1;
}

export function drawLegs(context: CanvasRenderingContext2D, legs: Legs) {
  context.save();
  context.lineCap = "round";
  for (let i = 0; i < LEGS.count; i++) {
    bone(context, legs.hipX[i], legs.hipY[i], legs.kneeX[i], legs.kneeY[i], LEGS.hipWidth, LEGS.kneeWidth);
    bone(context, legs.kneeX[i], legs.kneeY[i], legs.footX[i], legs.footY[i], LEGS.kneeWidth, LEGS.footWidth);
    context.fillStyle = SPIDER_PALETTE[1];
    context.beginPath();
    context.arc(legs.kneeX[i], legs.kneeY[i], LEGS.jointRadius, 0, 2 * Math.PI);
    context.fill();
  }
  context.restore();
}
