import { glyphMask } from "./glyphMask.js";
import type { GlyphMask } from "./glyphMask.js";
import { stageOutlines, stageSurfaces } from "./surfaces.js";
export type Anchor = { element: Element; center: boolean; alive: boolean; surface?: number;
  left: number; top: number; width: number; height: number; segmentX?: number; segmentY?: number; endX?: number; endY?: number; mask?: GlyphMask | null; point?: number; threadTouching?: boolean };

export function createAnchors(wake: () => void) {
  let entries: Anchor[] = [];
  let root: Element | null = null;
  let host: Element | null = null;
  let points: Float32Array | undefined;
  const sizes = new ResizeObserver(wake);
  function refresh() {
    if (!root) return;
    const next: Anchor[] = [];
    for (const element of root.querySelectorAll("[data-web-anchor]")) {
      const existing = entries.find((entry) => entry.element === element);
      const center = element.getAttribute("data-web-anchor") === "center";
      const entry = existing ?? { element, center, alive: true, left: 0, top: 0, width: 0, height: 0 };
      if (entry.center !== center) { entry.center = center; entry.mask = undefined; }
      next.push(entry);
    }
    const nextHost = root.querySelector("[data-spider-surface]");
    const nextPoints = nextHost ? stageOutlines.get(nextHost) : undefined;
    if (nextHost && nextPoints) {
      let top = Infinity;
      for (let i = 1; i < nextPoints.length; i += 2) top = Math.min(top, nextPoints[i]);
      for (let i = 0; i < nextPoints.length; i += 2) {
        const nextPoint = (i + 2) % nextPoints.length;
        // The artwork's flat cropped top is not a physical edge to hang a curtain from.
        if (nextPoints[i + 1] <= top + 0.002 && nextPoints[nextPoint + 1] <= top + 0.002) continue;
        const existing = nextHost === host && nextPoints === points && entries.find(entry => entry.point === i);
        next.push(existing || { element: nextHost, point: i, center: true,
          alive: true, left: 0, top: 0, width: 1, height: 1 });
      }
    }
    host = nextHost; points = nextPoints;
    const surfaces = host && stageSurfaces.get(host);
    if (host && surfaces) for (let i = 0; i < surfaces.length; i += 4) {
      const existing = entries.find(entry => entry.element === host && entry.surface === i);
      next.push(existing ?? { element: host, surface: i, center: false,
        alive: true, left: 0, top: 0, width: 0, height: 0 });
    }
    for (const entry of entries) if (!next.includes(entry)) entry.alive = false;
    entries = next;
    sizes.disconnect();
    for (const entry of entries) sizes.observe(entry.element);
    wake();
  }
  const mutations = new MutationObserver((records) => {
    if (records.some((record) => record.type === "childList" || record.attributeName === "data-web-anchor")) refresh();
    else wake();
  });
  function init(target: Element) {
    root = target;
    target.addEventListener("stage-outline-ready", refresh);
    void document.fonts.ready.then(() => { for (const entry of entries) entry.mask = undefined; wake(); });
    refresh();
    mutations.observe(target, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["data-web-anchor", "style", "inert", "aria-hidden"] });
  }
  // All live rect reads finish together before either canvas submits drawing.
  function read() {
    const stage = points && host?.getBoundingClientRect();
    for (const entry of entries) {
      if (entry.surface !== undefined && stage && host) {
        const surface = stageSurfaces.get(host)!;
        const i = entry.surface;
        entry.left = stage.left + surface[i] * stage.width;
        entry.top = stage.top + surface[i + 1] * stage.height;
        entry.width = surface[i + 2] * stage.width;
        entry.height = surface[i + 3] * stage.height;
        entry.alive = stage.width > 0 && stage.height > 0;
        continue;
      }
      if (entry.point !== undefined && points && stage) {
        const next = (entry.point + 2) % points.length;
        entry.segmentX = stage.left + points[entry.point] * stage.width;
        entry.segmentY = stage.top + points[entry.point + 1] * stage.height;
        entry.endX = stage.left + points[next] * stage.width;
        entry.endY = stage.top + points[next + 1] * stage.height;
        entry.left = Math.min(entry.segmentX, entry.endX); entry.top = Math.min(entry.segmentY, entry.endY);
        entry.width = Math.max(Number.EPSILON, Math.abs(entry.endX - entry.segmentX));
        entry.height = Math.max(Number.EPSILON, Math.abs(entry.endY - entry.segmentY));
        entry.alive = stage.width > 0 && stage.height > 0;
        continue;
      }
      const rect = entry.element.getBoundingClientRect();
      entry.alive = entry.element.isConnected && !entry.element.closest("[inert]") && rect.width > 0 && rect.height > 0;
      // Retain the last valid pin geometry when a route removes its element.
      if (!entry.alive) continue;
      if (entry.mask === undefined || entry.width !== rect.width || entry.height !== rect.height) {
        entry.mask = entry.center ? null : glyphMask(entry.element);
      }
      entry.left = rect.left; entry.top = rect.top; entry.width = rect.width; entry.height = rect.height;
    }
  }
  function dispose() {
    root?.removeEventListener("stage-outline-ready", refresh);
    mutations.disconnect(); sizes.disconnect();
    for (const entry of entries) entry.alive = false;
    entries = []; root = null;
  }
  return { init, read, dispose, get entries() { return entries; } };
}
export type Anchors = ReturnType<typeof createAnchors>;
