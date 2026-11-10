export type GlyphMask = { width: number; height: number; pixels: Uint8ClampedArray; edges: Float32Array };

export function glyphMask(element: Element): GlyphMask | null {
  const labels = element.querySelectorAll(".nav-label, .heading-line");
  if (!labels.length) return null;
  const rect = element.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(rect.width)); canvas.height = Math.max(1, Math.ceil(rect.height));
  const ctx = canvas.getContext("2d")!;
  for (const label of labels) {
    const style = getComputedStyle(label);
    const range = document.createRange(); range.selectNodeContents(label);
    const bounds = range.getBoundingClientRect();
    ctx.font = style.font; ctx.fillStyle = "white";
    const text = style.textTransform === "uppercase" ? label.textContent!.toUpperCase() : label.textContent!;
    const metrics = ctx.measureText(text);
    const ascent = metrics.fontBoundingBoxAscent, descent = metrics.fontBoundingBoxDescent;
    ctx.fillText(text, bounds.left - rect.left, bounds.top - rect.top + (bounds.height - ascent - descent) / 2 + ascent);
  }
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const edges: number[] = [];
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < canvas.width && y < canvas.height && pixels[(y * canvas.width + x) * 4 + 3] >= 128;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (solid(x,y) && (!solid(x-1,y) || !solid(x+1,y) || !solid(x,y-1) || !solid(x,y+1)))
      edges.push((x + 0.5) / rect.width, (y + 0.5) / rect.height);
  }
  return { width: canvas.width, height: canvas.height, pixels, edges: new Float32Array(edges) };
}
