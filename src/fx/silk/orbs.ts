import { WET } from "../../config/wet.js";
import { SILK } from "../../config/fx.js";

export function createOrbs(navHeight: number) {
  const { orbCap, orbNodes, spokes } = WET;
  const x = new Float64Array(orbCap * orbNodes), y = new Float64Array(x.length);
  const opacity = new Float64Array(orbCap), fading = new Uint8Array(orbCap);
  const state = { count: 0, capped: false, waiting: false, fading: false };
  let width = 0, height = 0, zone = -1, elapsed = 0, visited = false;
  function resize(w: number, h: number) {
    width = w; height = h;
    for (let slot = 0; slot < orbCap; slot++) {
      const start = slot * orbNodes, right = slot % 2, inner = slot >= 2;
      const rx = w * WET.orbWidth * (inner ? 0.66 : 1), ry = h * WET.orbHeight;
      const margin = inner ? w * WET.zoneWidth : rx;
      const cx = right ? w - margin : margin, cy = navHeight + ry * (inner ? 1.7 : 1);
      x[start] = cx; y[start] = cy;
      for (let i = 1; i < orbNodes; i++) {
        const radial = i <= spokes;
        const spoke = radial ? i - 1 : (i - spokes - 1) % spokes;
        const angle = Math.PI * 2 * spoke / spokes + slot + 0.065 * Math.sin(spoke * 7 + slot);
        const radius = radial ? 1 : (i - spokes) / (orbNodes - spokes);
        const variation = 1 + 0.12 * Math.sin(spoke * 3 + slot);
        x[start + i] = cx + Math.cos(angle) * rx * radius * variation;
        y[start + i] = cy + Math.sin(angle) * ry * radius * variation;
      }
    }
  }
  function build(side: number) {
    for (let i = side; i < orbCap; i += 2) {
      if (opacity[i]) continue;
      opacity[i] = 1; state.count++; return;
    }
    state.capped = state.count === orbCap;
  }
  function step(dt: number, sx: number, sy: number, enabled: boolean) {
    if (!WET.orbsEnabled) return;
    const side = !enabled || sy < navHeight || sy > navHeight + height * WET.zoneDepth
      ? -1 : sx < width * WET.zoneWidth ? 0 : sx > width * (1 - WET.zoneWidth) ? 1 : -1;
    if (side !== zone) { zone = side; visited = false; elapsed = 0; }
    state.waiting = side >= 0 && !visited;
    if (state.waiting && (elapsed += dt) >= WET.dwell) { build(side); visited = true; state.waiting = false; }
    state.fading = false;
    for (let i = 0; i < orbCap; i++) if (fading[i]) {
      opacity[i] = Math.max(0, opacity[i] - dt / SILK.fadeDuration);
      if (opacity[i]) state.fading = true;
      else { fading[i] = 0; state.count--; }
    }
  }
  function clear() {
    for (let i = 0; i < orbCap; i++) if (opacity[i]) fading[i] = 1;
    visited = true; state.capped = false; state.fading = state.count > 0;
  }
  function offset(i: number) { return (1 - opacity[i]) ** 2 * WET.dripGravity * SILK.fadeDuration ** 2 / 2; }
  function draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = SILK.color;
    for (let slot = 0; slot < orbCap; slot++) {
      if (!opacity[slot]) continue;
      const a = slot * orbNodes, dy = offset(slot);
      ctx.globalAlpha = opacity[slot] * SILK.alpha * WET.orbAlpha;
      ctx.lineWidth = SILK.width; ctx.beginPath();
      for (let n = a + 1; n <= a + spokes; n++) {
        ctx.moveTo(x[a], y[a] + dy); ctx.lineTo(x[n], y[n] + dy);
      }
      ctx.stroke(); ctx.lineWidth = SILK.fiberWidth * 2;
      ctx.beginPath(); ctx.moveTo(x[a], y[a] + dy);
      let last = a;
      for (let n = a + spokes + 1; n < a + orbNodes; n++) {
        const sag = Math.abs(x[last] - x[n]) * WET.spiralSag;
        ctx.quadraticCurveTo((x[last] + x[n]) / 2, (y[last] + y[n]) / 2 + sag + dy, x[n], y[n] + dy);
        last = n;
      }
      ctx.stroke();
    }
  }
  return { x, y, opacity, offset, state, resize, step, clear, draw };
}
export type Orbs = ReturnType<typeof createOrbs>;
