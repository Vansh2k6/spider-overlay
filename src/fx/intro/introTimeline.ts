import { gsap } from "gsap";
import { SPIDER_ENTRANCE as C } from "../../config/fx.js";

export const introLifecycle = import.meta.env?.DEV ? { created: 0, killed: 0, live: 0 } : null;

export function createIntroTimeline(motion: { descent: number; fall: number }) {
  const timeline = gsap.timeline({ paused: true });
  timeline.to(motion, { descent: 1, duration: C.duration, ease: "sine.inOut" })
    .to(motion, { fall: 1, duration: C.fallDuration, ease: "none" }, C.duration + C.pause);
  if (introLifecycle) { introLifecycle.created++; introLifecycle.live++; }
  return {
    advance(elapsed: number) { timeline.time(elapsed); },
    dispose() {
      timeline.kill();
      if (introLifecycle) { introLifecycle.killed++; introLifecycle.live--; }
    },
  };
}
