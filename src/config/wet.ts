export const WET = {
  beadCap: 600, beadSpacing: 110, beadMin: 1.2, beadMax: 3.5, spriteSize: 24,
  beadTint: "#A5C5FF", beadHighlight: "#FFFFFF", beadAlpha: 0.58,
  dripCap: 8, dripInterval: 2.4, minDripInterval: 0.12, slideSpeed: 60, slideDuration: 0.65,
  dripGravity: 400, dripLifetime: 1.5, dripLength: 8,
  orbsEnabled: false,
  orbCap: 4, orbNodes: 96, spokes: 10, dwell: 1.6, zoneWidth: 0.22,
  zoneDepth: 0.26, orbWidth: 0.055, orbHeight: 0.05, orbAlpha: 0.35,
  capacityMessage: "Web capacity reached. Existing silk stays. Delete or Backspace clears it.",
  junctionLength: 84, junctionWidth: 36, junctionLinkRadius: 64, junctionLinks: 3, junctionAlpha: 0.70,
  junctionFibers: 5, crossLinks: 4, frayCount: 7, frayLength: 12,
  junctionLineWidth: 0.55, frayAlpha: 0.38,
  fanSpacing: 3, spiralSag: 0.10,
} as const;
