import { drawJunctions } from "./junctions.js";
import type { Ropes } from "./rope.js";
import type { Orbs } from "./orbs.js";
import type { createDew } from "./dew.js";
import { drawRopes } from "./draw.js";

export function createSilkLayer(r: Ropes, o: Orbs, dew: ReturnType<typeof createDew>) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  let width = 0, height = 0, previousSerial = -1, previousNodes = -1;
  let previousBeads = -1, previousOrbs = -1, moving = true, invalid = true;
  function resize(w: number, h: number, dpr: number) {
    width = w; height = h;
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0); invalid = true;
  }
  function draw(target: CanvasRenderingContext2D) {
    if (invalid || moving || r.active || o.state.fading || previousSerial !== r.serial
      || previousNodes !== r.nodes || previousBeads !== dew.state.beads || previousOrbs !== o.state.count) {
      ctx.clearRect(0,0,width,height);
      o.draw(ctx); drawRopes(ctx,r,1); drawJunctions(ctx,r); dew.drawBeads(ctx); ctx.globalAlpha = 1;
      previousSerial=r.serial; previousNodes=r.nodes; previousBeads=dew.state.beads; previousOrbs=o.state.count;
      moving=r.active || o.state.fading; invalid=false;
    }
    target.drawImage(canvas,0,0,width,height);
    dew.drawDrips(target);
  }
  return {resize,draw};
}
