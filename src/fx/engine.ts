import { WET } from "../config/wet.js";
import { createRopes, stepRopes } from "./silk/rope.js";
import { createWeb } from "./silk/web.js";
import { createSilkLayer } from "./silk/layer.js";
import { createDew } from "./silk/dew.js";
import { createOrbs } from "./silk/orbs.js";
import { FRONT_OFFSET, FX, SILK, spiderRenderScale } from "../config/fx.js";
import { subscribeKeyDown, keyboard, requestWebClear, webInput, inputDiagnostics, pointer, pounceInput, subscribeInput } from "./input.js";
import { createSpider, placeSpider, stepSpider, stopSpider } from "./spider/spider.js";
import { closeSpiderSprites, drawSpider, loadSpiderSprites } from "./spider/draw.js";
import type { SpiderSprites } from "./spider/draw.js";
import { createLegs, resetLegs, stepLegs } from "./spider/legs.js";
import type { Anchor } from "./silk/anchors.js";
import { createAnchors } from "./silk/anchors.js";
import { introLifecycle } from "./intro/introTimeline.js";
import { createEntrance } from "./spider/entrance.js";
import { createRest, restVisibility, stepRest } from "./spider/rest.js";
import { beginPounce, createPounce, stepPounce } from "./spider/pounce.js";

const lifecycle = import.meta.env?.DEV ? { setups: 0, disposals: 0, activeEngines: 0, activeRequests: 0 } : null;

export function createFxEngine(onError: (message: string) => void, navHeight: number) {
  const spider = createSpider();
  const legs = createLegs();
  const anchors = createAnchors(inputChanged);
  const ropes = createRopes();
  const web = createWeb(ropes, anchors);
  const orbs = createOrbs(navHeight);
  const dew = createDew(ropes, orbs);
  const silkLayer = createSilkLayer(ropes, orbs, dew);
  let clearSequence = webInput.clearSequence, blockedMove = -Infinity;
  let unsubscribeKeys: (() => void) | undefined;
  const entrance = createEntrance(matchMedia("(prefers-reduced-motion: reduce)").matches);
  const rest = createRest();
  const pounce = createPounce();
  let pounceSequence = pounceInput.sequence;
  let restTimer: ReturnType<typeof setTimeout> | undefined, restWake = Infinity;
  let ceilingAnchor: Anchor | null = null;
  let spinneretX = 0, spinneretY = 0;
  const abort = new AbortController();
  let capacity: HTMLElement | null = null, capped = false;
  let canvas: HTMLCanvasElement | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let sprites: SpiderSprites | null = null;
  let observer: ResizeObserver | null = null;
  let unsubscribe: (() => void) | undefined;
  let frame = 0, previousTime = 0, width = 0, height = 0;
  let renderScale = 1;
  let dirty = true, disposed = false;
  const stats = import.meta.env?.DEV ? { frames: 0, draws: 0, pending: 0, maxPending: 0 } : null;

  function draw() {
    if (!canvas || !context || !sprites) return;
    context.clearRect(0, 0, width / renderScale, height / renderScale);
    context.save(); context.scale(1 / renderScale, 1 / renderScale);
    silkLayer.draw(context); context.restore();
    entrance.draw(context, spinneretX, spinneretY, renderScale);
    drawSpider(context, spider, sprites, legs, rest);
    dirty = false;
    if (stats) stats.draws++;
  }

  function wake() {
    if (frame || disposed || document.hidden || webInput.hidden || !sprites) return;
    frame = requestAnimationFrame(tick);
    if (lifecycle) lifecycle.activeRequests++;
    if (stats) { stats.pending = 1; stats.maxPending = Math.max(stats.maxPending, stats.pending); }
  }

  function stop() {
    if (frame) {
      cancelAnimationFrame(frame);
      if (lifecycle) lifecycle.activeRequests--;
    }
    frame = previousTime = 0;
    if (stats) stats.pending = 0;
  }

  // Batch anchor reads before physics/drawing; no React updates or buffer allocation.
  function tick(time: number) {
    frame = 0;
    if (lifecycle) lifecycle.activeRequests--;
    if (stats) { stats.pending = 0; stats.frames++; }
    if (disposed || document.hidden) { previousTime = 0; return; }
    const dt = previousTime ? Math.min((time - previousTime) / FX.millisecondsPerSecond, FX.maxDt) : FX.initialDt;
    previousTime = time;
    anchors.read();
    const wasMoving = entrance.state.fall < 1 || pounce.active || spider.moving || legs.activeGroup >= 0 || rest.active;
    if (dt <= 0) { wake(); return; }
    const descending = entrance.state.active;
    entrance.advance(spider, dt);
    if (descending) {
      stepLegs(legs, spider, dt);
    } else if (pounce.active) {
      stepPounce(pounce, spider, legs, dt);
    } else {
      stepSpider(spider, pointer.x / renderScale, pointer.y / renderScale, pointer.active, dt);
      stepLegs(legs, spider, dt);
    }
    updateSilk();
    if (descending && !entrance.state.active && ceilingAnchor)
      web.begin(ceilingAnchor, spinneretX, spinneretY, time / FX.millisecondsPerSecond);
    const hadSilk = ropes.nodes || orbs.state.count || dew.state.drips;
    const enabled = !descending && !pointer.virtual && pointer.active && pointer.lastMoveAt > blockedMove;
    web.step(time / FX.millisecondsPerSecond, spinneretX, spinneretY, enabled, pointer.lastMoveAt);
    stepRopes(ropes, dt, spider.x * renderScale, spider.y * renderScale, spider.vx * renderScale, spider.vy * renderScale);
    web.count();
    orbs.step(dt, spider.x * renderScale, spider.y * renderScale, enabled);
    dew.step(dt);
    const nextCap = web.state.capacityReached || orbs.state.capped || dew.state.beadCapReached || dew.state.dripCapReached;
    if (nextCap !== capped && capacity) {
      capped = nextCap; capacity.hidden = !capped;
      capacity.textContent = capped ? WET.capacityMessage : "";
    }
    const silkActive = ropes.active || dew.state.beads || dew.state.drips || orbs.state.waiting || orbs.state.fading;
    const headChanged = stepRest(rest, !entrance.state.active && !pounce.active && !spider.moving && legs.activeGroup < 0,
      dt, time / FX.millisecondsPerSecond);
    if (!pounce.active) spider.mode = rest.blend > 0 && !spider.moving ? "rest" : "walk";
    if (dirty || hadSilk || silkActive || wasMoving || headChanged || spider.moving || legs.activeGroup >= 0) draw();
    scheduleRest();
    if (silkActive || entrance.state.fall < 1 || pounce.active || spider.moving || legs.activeGroup >= 0 || rest.active) wake();
    else previousTime = 0;
  }

  function inputChanged() {
    const visibility = webInput.hidden ? "hidden" : "visible";
    if (canvas && canvas.style.visibility !== visibility) canvas.style.visibility = visibility;
    if (clearSequence !== webInput.clearSequence) {
      clearSequence = webInput.clearSequence; blockedMove = pointer.lastMoveAt;
      web.clear(blockedMove); orbs.clear(); dew.clear(); dirty = true;
    }
    restVisibility(rest, document.hidden, performance.now() / FX.millisecondsPerSecond);
    if (pounceSequence !== pounceInput.sequence) {
      pounceSequence = pounceInput.sequence;
      if (!entrance.state.active && !document.hidden && !webInput.hidden) beginPounce(pounce, spider, legs,
        pounceInput.x / renderScale, pounceInput.y / renderScale);
    }
    if (document.hidden || webInput.hidden) {
      if (webInput.hidden) entrance.releasePointer();
      stop(); stopSpider(spider); clearTimeout(restTimer); restWake = Infinity;
      return;
    }
    wake();
  }

  function restDue() { restWake = Infinity; wake(); }
  function scheduleRest() {
    const next = rest.active ? Infinity : rest.deadline;
    if (restWake === next) return;
    clearTimeout(restTimer); restWake = next;
    if (Number.isFinite(next)) restTimer = setTimeout(restDue,
      Math.max(0, next * FX.millisecondsPerSecond - performance.now()));
  }

  function updateSilk() {
    const rotation = spider.heading + FRONT_OFFSET, y = SILK.spinneretY + legs.bob;
    spinneretX = (spider.x + Math.cos(rotation) * SILK.spinneretX - Math.sin(rotation) * y) * renderScale;
    spinneretY = (spider.y + Math.sin(rotation) * SILK.spinneretX + Math.cos(rotation) * y) * renderScale;
  }

  function resize() {
    if (!canvas || !context || disposed) return;
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    if (ceilingAnchor) ceilingAnchor.left = width / 2;
    orbs.resize(width, height); web.resetSweep();
    renderScale = spiderRenderScale(width, height);
    const dpr = Math.min(window.devicePixelRatio || 1, FX.dprCap);
    silkLayer.resize(width,height,dpr);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    context.setTransform(dpr * renderScale, 0, 0, dpr * renderScale, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const oldX = spider.x, oldY = spider.y;
    if (entrance.state.active) entrance.resize(spider, width, height, renderScale);
    else placeSpider(spider, width / renderScale, height / renderScale);
    if (!legs.ready || spider.x !== oldX || spider.y !== oldY) resetLegs(legs, spider);
    updateSilk();
    dirty = true;
    wake();
  }

  function diagnostics() {
    if (import.meta.env?.DEV && canvas && stats) {
      canvas.dataset.fxDiagnostics = JSON.stringify({ ...stats, lifecycle, spider, legs, entrance: entrance.state, introLifecycle, rest, restWake, pounce,
        web: web.state, nodes: ropes.nodes, orbs: orbs.state, dew: dew.state,
        spinneretX, spinneretY, anchors: anchors.entries.length, input: inputDiagnostics(),
        pointer, pounceInput, width, height, hidden: document.hidden,
        renderScale, coordinateSpace: "spider units", stopRadius: FX.stopRadius * renderScale,
        frontOffset: FRONT_OFFSET, rotation: spider.heading + FRONT_OFFSET });
    }
  }

  function init(target: HTMLCanvasElement) {
    canvas = target;
    canvas.dataset.fxStatus = "loading";
    ceilingAnchor = { element: target, center: true, alive: true, left: 0, top: 0, width: 1, height: 1 };
    capacity = target.parentElement?.querySelector<HTMLElement>(".fx-capacity") ?? null;
    context = canvas.getContext("2d");
    if (!context) { onError("Canvas 2D is unavailable."); return; }
    if (lifecycle) { lifecycle.setups++; lifecycle.activeEngines++; }
    resize();
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    unsubscribeKeys = subscribeKeyDown(event => {
      if (!webInput.hidden && !keyboard.editing && !event.defaultPrevented
        && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault(); requestWebClear();
      }
    });
    unsubscribe = subscribeInput(inputChanged);
    anchors.init(target.closest("[data-spider-root]") ?? document.body);
    inputChanged();
    if (import.meta.env?.DEV) canvas.addEventListener("fx-inspect", diagnostics);
    void loadSpiderSprites(abort.signal).then((loaded) => {
      if (disposed) { closeSpiderSprites(loaded); return; }
      sprites = loaded;
      if (canvas) canvas.dataset.fxStatus = "ready";
      wake();
    }).catch((error: unknown) => {
      if (disposed) return;
      onError(error instanceof Error ? error.message : "Spider sprites unavailable.");
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    stop();
    observer?.disconnect();
    anchors.dispose(); entrance.dispose();
    clearTimeout(restTimer);
    unsubscribeKeys?.(); unsubscribe?.();
    if (canvas && import.meta.env?.DEV) canvas.removeEventListener("fx-inspect", diagnostics);
    if (context && lifecycle) { lifecycle.disposals++; lifecycle.activeEngines--; }
    if (sprites) closeSpiderSprites(sprites);
    sprites = null;
    if (capacity) { capacity.hidden = true; capacity.textContent = ""; }
    if (canvas) canvas.width = canvas.height = 0;
    canvas = context = null;
  }
  return { init, resize, dispose };
}
