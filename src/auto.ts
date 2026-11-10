import { mountSpider } from "./index.js";
import "./overlay.css";

let dispose: (() => void) | undefined;

function start() {
  if (document.querySelector("[data-spider-overlay-auto]")) return;
  const host = document.createElement("div");
  host.dataset.spiderOverlayAuto = "";
  const canvas = document.createElement("canvas");
  const status = document.createElement("span");
  status.className = "fx-capacity";
  status.hidden = true;
  status.setAttribute("role", "status");
  host.append(canvas, status);
  document.body.append(host);

  try {
    const stop = mountSpider(canvas, { onError: (message) => {
      host.remove();
      console.warn(`Spider Overlay: ${message}`);
    } });
    dispose = () => { stop(); host.remove(); };
  } catch (error) {
    host.remove();
    throw error;
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  import.meta.hot?.dispose(() => {
    document.removeEventListener("DOMContentLoaded", start);
    dispose?.();
  });
}
