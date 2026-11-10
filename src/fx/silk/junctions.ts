import { SILK } from "../../config/fx.js";
import { WET } from "../../config/wet.js";
import type { Ropes } from "./rope.js";

function junction(ctx: CanvasRenderingContext2D, r: Ropes, slot: number, end: boolean) {
  const first = slot * SILK.nodesPerRope;
  const tip = end ? first + SILK.nodesPerRope - 1 : first;
  const neighbor = end ? tip - 6 : tip + 6;
  const x = r.x[tip], y = r.y[tip];
  const dx = r.x[neighbor] - x, dy = r.y[neighbor] - y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;
  const ux = dx / distance, uy = dy / distance;
  const seed = r.birth[slot] * SILK.fiberSeed + Number(end);
  const length = Math.min(WET.junctionLength, distance);
  const spread = Math.min(WET.junctionWidth, length / 3);
  ctx.lineWidth = WET.junctionLineWidth;
  ctx.globalAlpha = r.opacity[slot] * WET.junctionAlpha;
  ctx.beginPath();
  // All branches converge on the actual contact; the small fan lies along its outgoing silk.
  for (let i = 0; i < WET.junctionFibers; i++) {
    const offset = (i / (WET.junctionFibers - 1) - 0.5) * spread * (1 + 0.25 * Math.sin(seed + i));
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + ux * length * 0.35 - uy * offset,
      y + uy * length * 0.35 + ux * offset,
      x + ux * length, y + uy * length);
  }
  for (let i = 1; i <= WET.crossLinks; i++) {
    const t = i / (WET.crossLinks + 1);
    const width = spread * t * (1 - t) * (1 + 0.3 * Math.sin(seed + i));
    const cx = x + ux * length * t, cy = y + uy * length * t;
    ctx.moveTo(cx - uy * width, cy + ux * width);
    ctx.quadraticCurveTo(cx + ux * width, cy + uy * width,
      cx + uy * width, cy - ux * width);
  }
  ctx.stroke();
  ctx.globalAlpha = r.opacity[slot] * WET.frayAlpha;
  ctx.beginPath();
  for (let i = 0; i < WET.frayCount; i++) {
    const angle = seed + i * 2.399963;
    const reach = WET.frayLength * (0.35 + 0.65 * Math.abs(Math.sin(seed * 3 + i)));
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(angle + 0.4) * reach * 0.6,
      y + Math.sin(angle + 0.4) * reach * 0.6,
      x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  ctx.stroke();
}

export function drawJunctions(ctx: CanvasRenderingContext2D, r: Ropes) {
  ctx.save(); ctx.strokeStyle = SILK.color;
  for (let slot = 0; slot < r.slots; slot++) {
    if (!r.state[slot] || !r.kind[slot]) continue;
    junction(ctx, r, slot, false);
    if (r.kind[slot] === 1) junction(ctx, r, slot, true);
  }
  // Cross-ties join nearby real contacts, producing local irregular triangles.
  for (let endpoint = 0; endpoint < r.slots * 2; endpoint++) {
    const slot = Math.floor(endpoint / 2), end = endpoint % 2;
    if (!r.state[slot] || !r.kind[slot] || (end && r.kind[slot] !== 1)) continue;
    const a = slot * SILK.nodesPerRope + (end ? SILK.nodesPerRope - 1 : 0);
    let linked = 0;
    for (let other = endpoint + 1; other < r.slots * 2 && linked < WET.junctionLinks; other++) {
      const s = Math.floor(other / 2), e = other % 2;
      if (s === slot || !r.state[s] || !r.kind[s] || (e && r.kind[s] !== 1)) continue;
      const b = s * SILK.nodesPerRope + (e ? SILK.nodesPerRope - 1 : 0);
      const dx = r.x[b] - r.x[a], dy = r.y[b] - r.y[a];
      const distance = Math.hypot(dx, dy);
      if (distance < WET.fanSpacing || distance > WET.junctionLinkRadius) continue;
      ctx.globalAlpha = Math.min(r.opacity[s], r.opacity[slot]) * WET.junctionAlpha;
      ctx.beginPath(); ctx.moveTo(r.x[a], r.y[a]);
      ctx.quadraticCurveTo((r.x[a] + r.x[b]) / 2, (r.y[a] + r.y[b]) / 2 + distance / 3, r.x[b], r.y[b]);
      const branch = b + (e ? -2 : 2);
      ctx.moveTo(r.x[a], r.y[a]);
      ctx.quadraticCurveTo((r.x[a] + r.x[branch]) / 2,
        (r.y[a] + r.y[branch]) / 2 + distance / 4, r.x[branch], r.y[branch]);
      ctx.stroke(); linked++;
    }
  }
  ctx.restore();
}
