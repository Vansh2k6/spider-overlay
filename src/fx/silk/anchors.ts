import { glyphMask } from "./glyphMask.js";
import type { GlyphMask } from "./glyphMask.js";
import { stageOutlines, stageSurfaces } from "./surfaces.js";
import { WEB } from "../../config/fx.js";

const automaticSelector = 'a[href], button, summary, h1, h2, h3, h4, h5, h6, img, [role="button"], [role="link"], [role="heading"]';
const excludedSelector = '[hidden], [inert], [aria-hidden="true"], [data-web-anchor="none"]';

export type Anchor = { element: Element; center: boolean; alive: boolean; surface?: number;
  left: number; top: number; width: number; height: number; segmentX?: number; segmentY?: number; endX?: number; endY?: number; mask?: GlyphMask | null; point?: number; threadTouching?: boolean };

export function createAnchors(wake: () => void, automatic: boolean) {
  let manual: Anchor[] = [];
  let candidates = new Map<Element, Anchor>();
  const nearby: Anchor[] = [];
  const entries: Anchor[] = [];
  let root: Element | null = null;
  let host: Element | null = null;
  let points: Float32Array | undefined;
  let refreshPending = false;
  let geometryDirty = true;
  const sizes = new ResizeObserver(invalidate);
  const intersections = automatic ? new IntersectionObserver(invalidate) : null;

  function invalidate() {
    geometryDirty = true;
    wake();
  }

  function refresh() {
    if (!root) return;
    refreshPending = false;
    const existing = new Map(candidates);
    for (const entry of manual) {
      if (entry.point === undefined && entry.surface === undefined) existing.set(entry.element, entry);
    }
    function domAnchor(element: Element, center: boolean) {
      const entry = existing.get(element) ?? { element, center, alive: true, left: 0, top: 0, width: 0, height: 0 };
      if (entry.center !== center) { entry.center = center; entry.mask = undefined; }
      existing.delete(element);
      return entry;
    }

    const next: Anchor[] = [];
    for (const element of root.querySelectorAll("[data-web-anchor]")) {
      if (element.getAttribute("data-web-anchor") !== "none") {
        next.push(domAnchor(element, element.getAttribute("data-web-anchor") === "center"));
      }
    }
    const nextCandidates = new Map<Element, Anchor>();
    if (automatic) for (const element of root.querySelectorAll(automaticSelector)) {
      if (!element.hasAttribute("data-web-anchor")) nextCandidates.set(element, domAnchor(element, false));
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
        const outline = nextHost === host && nextPoints === points && manual.find(entry => entry.point === i);
        next.push(outline || { element: nextHost, point: i, center: true,
          alive: true, left: 0, top: 0, width: 1, height: 1 });
      }
    }
    host = nextHost; points = nextPoints;
    const surfaces = host && stageSurfaces.get(host);
    if (host && surfaces) for (let i = 0; i < surfaces.length; i += 4) {
      const region = manual.find(entry => entry.element === host && entry.surface === i);
      next.push(region ?? { element: host, surface: i, center: false,
        alive: true, left: 0, top: 0, width: 0, height: 0 });
    }
    for (const entry of existing.values()) entry.alive = false;
    for (const entry of manual) {
      if ((entry.point !== undefined || entry.surface !== undefined) && !next.includes(entry)) entry.alive = false;
    }
    for (const element of candidates.keys()) if (!nextCandidates.has(element)) intersections?.unobserve(element);
    for (const element of nextCandidates.keys()) if (!candidates.has(element)) intersections?.observe(element);
    candidates = nextCandidates;
    manual = next;
    sizes.disconnect();
    sizes.observe(root);
    for (const entry of manual) sizes.observe(entry.element);
    invalidate();
  }
  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        // Status text and text edits cannot add or remove an anchor element.
        for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) refreshPending = true;
        for (const node of record.removedNodes) if (node.nodeType === Node.ELEMENT_NODE) refreshPending = true;
      } else if (record.attributeName === "data-web-anchor" || record.attributeName === "data-spider-surface"
        || record.attributeName === "href" || record.attributeName === "role") refreshPending = true;
    }
    invalidate();
  });
  function init(target: Element) {
    root = target;
    target.addEventListener("stage-outline-ready", refresh);
    window.addEventListener("scroll", invalidate, { capture: true, passive: true });
    window.addEventListener("resize", invalidate);
    void document.fonts.ready.then(() => {
      if (!root) return;
      for (const entry of manual) entry.mask = undefined;
      invalidate();
    });
    refresh();
    mutations.observe(target, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["data-web-anchor", "data-spider-surface", "href", "role", "class", "style", "hidden", "inert", "aria-hidden"] });
  }

  function readElement(entry: Anchor, useGlyphMask: boolean) {
    const { element } = entry;
    const rect = element.getBoundingClientRect();
    entry.alive = element.isConnected && rect.width > 0 && rect.height > 0 && !element.closest(excludedSelector);
    if (entry.alive && !useGlyphMask) {
      entry.alive = element.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })
        ?? getComputedStyle(element).visibility === "visible";
    }
    // Retain the last valid pin geometry when a route removes its element.
    if (!entry.alive) return;
    if (useGlyphMask && (entry.mask === undefined || entry.width !== rect.width || entry.height !== rect.height)) {
      entry.mask = entry.center ? null : glyphMask(element);
    } else if (!useGlyphMask) entry.mask = undefined;
    entry.left = rect.left; entry.top = rect.top; entry.width = rect.width; entry.height = rect.height;
  }

  function inViewport(entry: Anchor, width: number, height: number) {
    return entry.alive && entry.left < width && entry.top < height
      && entry.left + entry.width > 0 && entry.top + entry.height > 0;
  }

  // Read the full candidate set on layout changes so existing silk moves with the page.
  // During animation, only read the bounded set that can catch new silk.
  function read() {
    if (refreshPending) refresh();
    const width = window.innerWidth, height = window.innerHeight;
    if (geometryDirty) {
      nearby.length = 0;
      for (const entry of candidates.values()) {
        readElement(entry, false);
        if (nearby.length < WEB.maxAutomaticAnchors && inViewport(entry, width, height)) nearby.push(entry);
      }
    } else for (const entry of nearby) readElement(entry, false);
    geometryDirty = false;
    entries.length = 0;
    const stage = points && host?.getBoundingClientRect();
    for (const entry of manual) {
      entries.push(entry);
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
      readElement(entry, true);
    }
    for (const entry of nearby) if (inViewport(entry, width, height)) entries.push(entry);
  }
  function dispose() {
    root?.removeEventListener("stage-outline-ready", refresh);
    window.removeEventListener("scroll", invalidate, true);
    window.removeEventListener("resize", invalidate);
    mutations.disconnect(); sizes.disconnect(); intersections?.disconnect();
    for (const entry of manual) entry.alive = false;
    for (const entry of candidates.values()) entry.alive = false;
    manual = []; candidates.clear(); nearby.length = 0; entries.length = 0; root = null;
  }
  return { init, read, dispose, get entries() { return entries; } };
}
export type Anchors = ReturnType<typeof createAnchors>;
