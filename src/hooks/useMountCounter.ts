import { useLayoutEffect, useRef } from "react";

type Target = "stage" | "fx";
const counters = import.meta.env?.DEV ? {
  stage: { mounts: 0, active: 0, setups: 0 },
  fx: { mounts: 0, active: 0, setups: 0 },
} : null;

export function useMountCounter<T extends HTMLElement>(target: Target) {
  const element = useRef<T>(null);
  const counted = useRef(false);

  useLayoutEffect(() => {
    if (!counters || !element.current) return;
    const counter = counters[target];
    const node = element.current;
    // StrictMode replays effects on the same instance; only a new instance is a remount.
    if (!counted.current) { counter.mounts++; counted.current = true; }
    counter.active++;
    counter.setups++;
    node.dataset.mountCount = String(counter.mounts);
    node.dataset.activeMounts = String(counter.active);
    node.dataset.effectSetups = String(counter.setups);
    return () => { counter.active--; };
  }, [target]);

  return element;
}
