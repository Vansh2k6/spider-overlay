// Source art points down (+Y); movement headings use atan2 (+X = zero).
export const FRONT_OFFSET = -Math.PI / 2;
export const SPIDER_SCALE = {
  referenceBodyHeight: 810, referenceSize: 1.63, imageScale: 0.12,
  designWidth: 1440, designHeight: 810, minViewportFactor: 0.6, maxViewportFactor: 1.25,
  visibleBodyHeight: 64.25,
} as const;
export function spiderRenderScale(width: number, height: number) {
  const factor = Math.max(SPIDER_SCALE.minViewportFactor, Math.min(SPIDER_SCALE.maxViewportFactor,
    width / SPIDER_SCALE.designWidth, height / SPIDER_SCALE.designHeight));
  return SPIDER_SCALE.referenceBodyHeight * SPIDER_SCALE.referenceSize * SPIDER_SCALE.imageScale
    * factor / SPIDER_SCALE.visibleBodyHeight;
}
export const SPIDER_PALETTE = ["#4F6793", "#9A1316", "#223057", "#E72020"] as const;
export const LEGS = {
  count: 8, perSide: 4,
  // Reference renderer's forebody anchors/bone ratios, normalized to our visible body.
  hipX: [10.9, 11.7, 13.2, 12.5], hipY: [5.1, 8.6, 13.4, 20.9],
  kneeBend: [1, 1, -1, -1],
  homeX: [19, 43, 41, 23], homeY: [-35, -1, 38, 50],
  upperLength: [15.9, 10.3, 13.8, 10], lowerLength: [31, 30.2, 28.4, 27],
  reachEpsilon: 0.05, supportTolerance: 0.000001, supportIterations: 16,
  stepThreshold: 3, stepDuration: 0.14,
  minStepDuration: 0.055, cadenceSpeed: 3200,
  leadTime: 0.12, maxLead: 10, stepLift: 2.5, abdomenBob: 0.6,
  turnLead: 0.35,
  blockedSpeed: 0.01,
  landingMargin: 3,
  hipWidth: 6.2, kneeWidth: 4.4, footWidth: 1.6, jointRadius: 2,
  segmentCurve: 0.3,
  hairPositions: [0.16, 0.32, 0.5, 0.68, 0.84],
  hairLengths: [0.45, 0.65, 0.55, 0.6, 0.4],
  hairWidth: 0.3, hairAlpha: 0.45,
} as const;
export const FX = {
  dprCap: 2,
  maxDt: 0.05,
  initialDt: 1 / 60,
  millisecondsPerSecond: 1000,
  initialInset: 80,
  stopRadius: 56,
  resumeDistance: 3,
  settleDistance: 0.15,
  settleSpeed: 1,
  directionEpsilon: 0.001,
  followGain: 5,
  maxSpeed: 520,
  velocityTau: 0.08,
  headingTau: 0.055,
  headingSpeed: 2,
  abdomenWidth: 45.5,
  abdomenHeight: 39,
  abdomenY: -12,
  headWidth: 42,
  headHeight: 32,
  headY: 20,
} as const;

export const SILK = {
  maxNodes: 18000, nodesPerRope: 36, restLength: 12,
  fixedDt: 1 / 120, iterations: 6, gravity: 900, damping: 5,
  spinneretX: 0, spinneretY: -30,
  creationImpulse: 1.8, impulseRadius: 45, impulseGain: 0.12,
  settleSpeed: 0.8, settleDelay: 0.35, pinEpsilon: 0.001,
  fadeDuration: 0.5,
  color: "#ECE8FF", width: 0.85, alpha: 0.72, tailAlpha: 0.08,
  fiberWidth: 0.28, fiberAlpha: 0.32, fiberSpread: 1.2,
  glowWidth: 4, glowAlpha: 0.045,
  fiberFrequency: 0.71, fiberSeed: 1.37,
} as const;

export const WEB = {
  maxStrands: 500, expiry: Infinity,
  maxAutomaticAnchors: 48,
  minLength: 2, slack: 1.015, maxSlack: 12, sagFraction: 0.025,
  contactEpsilon: 0.000001, pointRadius: 3, sweepLimit: 32,
  remeshMin: 0.5, remeshMax: 2,
} as const;

export const SPIDER_ENTRANCE = {
  duration: 4.5, pause: 0.5, fallDuration: 0.5, fallDistance: 110, ropeWidth: 1.5, xFraction: 0.5, yFraction: 0.3,
  minY: 190, maxY: 280, startY: 0,
  heading: Math.PI / 2,
} as const;

export const SPIDER_REST = {
  idleDelay: 0.9, fadeIn: 0.35, fadeOut: 0.12,
  repeatDelay: 4.5, closedDuration: 0.11, openGap: 0.12,
} as const;

export const SPIDER_POUNCE = {
  minDuration: 0.38, maxDuration: 0.65, speed: 650, maxDistance: 320,
  height: 24, edgeMargin: 32, fold: 0.22,
} as const;

export const INTRO = { revealFollowsSpider: false } as const;
