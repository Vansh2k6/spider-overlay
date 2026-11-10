import { FRONT_OFFSET, FX } from "../../config/fx.js";
import type { Spider } from "./spider.js";
import type { Legs } from "./legs.js";
import { drawLegs } from "./drawLegs.js";
import type { Rest } from "./rest.js";
import { SPIDER_SPRITES } from "../../assets/spiderSprites.js";

export type SpiderSprites = { abdomen: ImageBitmap; head: ImageBitmap; restOpen: ImageBitmap; restClosed: ImageBitmap };

export function closeSpiderSprites(sprites: SpiderSprites) {
  sprites.abdomen.close(); sprites.head.close(); sprites.restOpen.close(); sprites.restClosed.close();
}

export async function loadSpiderSprites(signal: AbortSignal): Promise<SpiderSprites> {
  const results = await Promise.allSettled([
    SPIDER_SPRITES.abdomen, SPIDER_SPRITES.head, SPIDER_SPRITES.restOpen, SPIDER_SPRITES.restClosed,
  ].map(async (src) => {
    const response = await fetch(src, { signal });
    if (!response.ok) throw new Error(`Spider sprite failed to load (${response.status}).`);
    return createImageBitmap(await response.blob());
  }));
  const [abdomen, head, restOpen, restClosed] = results;
  if (signal.aborted || abdomen.status === "rejected" || head.status === "rejected"
    || restOpen.status === "rejected" || restClosed.status === "rejected") {
    results.forEach((result) => { if (result.status === "fulfilled") result.value.close(); });
    signal.throwIfAborted();
    throw new Error("Spider sprites unavailable. Check that the bundled images are served by your build.");
  }
  return { abdomen: abdomen.value, head: head.value, restOpen: restOpen.value, restClosed: restClosed.value };
}

export function drawSpider(context: CanvasRenderingContext2D, spider: Spider, sprites: SpiderSprites, legs: Legs, rest?: Rest) {
  drawLegs(context, legs);
  context.save();
  context.translate(spider.x, spider.y);
  context.rotate(spider.heading + FRONT_OFFSET);
  context.drawImage(sprites.abdomen, -FX.abdomenWidth / 2, FX.abdomenY + legs.bob - FX.abdomenHeight / 2,
    FX.abdomenWidth, FX.abdomenHeight);
  const blend = rest?.blend ?? 0;
  if (blend < 1) {
    context.globalAlpha = 1 - blend;
    context.drawImage(sprites.head, -FX.headWidth / 2, FX.headY - FX.headHeight / 2, FX.headWidth, FX.headHeight);
  }
  if (blend > 0) {
    context.globalAlpha = blend;
    context.drawImage(rest?.closed ? sprites.restClosed : sprites.restOpen,
      -FX.headWidth / 2, FX.headY - FX.headHeight / 2, FX.headWidth, FX.headHeight);
  }
  context.restore();
}
