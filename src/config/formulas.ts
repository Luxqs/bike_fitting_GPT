export const FORMULA_COEFFICIENTS = {
  saddleHeight: {
    inseamFactor: 0.883,
    flexibilityPenaltyMm: {
      low: 5,
      moderate: 0,
      high: -3,
    },
  },
  frame: {
    stackFromHeight: 0.36,
    reachFromHeight: 0.25,
    torsoWeight: 0.45,
    armWeight: 0.25,
  },
  cockpit: {
    torsoFactor: 0.55,
    armFactor: 0.35,
    flexibilityFactor: 8,
    goalFactor: 10,
  },
  crank: {
    inseamThresholds: [75, 82, 88],
    sizes: [165, 170, 172.5, 175],
  },
  confidence: {
    minimumUsableFrame: 0.45,
    preferredFrame: 0.65,
  },
};
