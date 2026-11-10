import { useEffect, useState } from "react";
import { mountSpider } from "../index.js";
import type { SpiderOptions } from "../index.js";
import { FX } from "../config/fx.js";
import { useMountCounter } from "../hooks/useMountCounter.js";

type FxCanvasProps = Pick<SpiderOptions, "navHeight" | "automaticAnchors"> & { active?: boolean };

export function FxCanvas({ active = true, navHeight, automaticAnchors }: FxCanvasProps) {
  const canvasRef = useMountCounter<HTMLCanvasElement>("fx");
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!canvasRef.current || !active) return;
    const canvas = canvasRef.current;
    try {
      return mountSpider(canvas, { navHeight, automaticAnchors, onError: setError });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Spider overlay unavailable.");
    }
  }, [active, canvasRef, navHeight, automaticAnchors]);
  useEffect(() => {
    if (active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    // A blank lifecycle shell needs correct backing dimensions but no engine or frame loop.
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio, FX.dprCap);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const observer = new ResizeObserver(resize);
    resize();
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [active, canvasRef]);
  return <>
    <canvas ref={canvasRef} className="fx-canvas" aria-hidden="true" data-fx-status={active ? "loading" : "inactive"} />
    <span className="fx-capacity" role="status" hidden />
    {error && <div className="fx-error" role="status">SPIDER PLACEHOLDER — {error}</div>}
  </>;
}
