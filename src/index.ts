import { createFxEngine } from "./fx/engine.js";

export { requestWebClear, setEffectsHidden } from "./fx/input.js";

export interface SpiderOptions {
  navHeight?: number;
  onError?: (message: string) => void;
}

let owner: symbol | undefined;

/** Mount the full-viewport overlay and return its teardown function. */
export function mountSpider(canvas: HTMLCanvasElement, { navHeight = 0, onError }: SpiderOptions = {}) {
  if (owner) throw new Error("Mount one spider overlay per page.");
  const instance = Symbol();
  const engine = createFxEngine((message) => {
    release("error");
    onError?.(message);
  }, navHeight);

  function release(status: "inactive" | "error") {
    if (owner !== instance) return;
    try {
      engine.dispose();
    } finally {
      canvas.dataset.fxStatus = status;
      owner = undefined;
    }
  }

  owner = instance;
  try {
    canvas.classList.add("fx-canvas");
    canvas.setAttribute("aria-hidden", "true");
    engine.init(canvas);
  } catch (error) {
    release("error");
    throw error;
  }
  return () => release("inactive");
}
