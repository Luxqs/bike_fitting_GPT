import { BIKE_CATEGORY_CONFIG } from '../../config/bikeCategories';
import { FORMULA_COEFFICIENTS } from '../../config/formulas';
import { ISSUE_ADJUSTMENTS } from '../../config/issues';
import { AppState, FitRecommendationItem, FitResult, MeasurementValue, RideType } from '../../types';
import { formatRange, formatValue } from '../../utils/format';
import { avg, clamp, round } from '../../utils/math';

const RIDE_TYPE_ADJUSTMENTS: Record<RideType, { reachDeltaMm: number; stackDeltaMm: number; dropDeltaMm: number; note: string }> = {
  'Comfort / leisure': {
    reachDeltaMm: -8,
    stackDeltaMm: 10,
    dropDeltaMm: -12,
    note: 'Comfort-focused rides usually support a shorter cockpit and a taller front end.',
  },
  'Endurance / long rides': {
    reachDeltaMm: -2,
    stackDeltaMm: 4,
    dropDeltaMm: -4,
    note: 'Long-distance riding usually favors a sustainable posture over a maximal racing position.',
  },
  'Race / fast group rides': {
    reachDeltaMm: 8,
    stackDeltaMm: -6,
    dropDeltaMm: 10,
    note: 'Race-oriented riding shifts fit targets toward a longer, lower, more aerodynamic position.',
  },
  'Training / fitness': {
    reachDeltaMm: 2,
    stackDeltaMm: 0,
    dropDeltaMm: 2,
    note: 'General training keeps a fairly neutral posture unless other inputs point more strongly one way.',
  },
  'Adventure / mixed terrain': {
    reachDeltaMm: -4,
    stackDeltaMm: 6,
    dropDeltaMm: -6,
    note: 'Adventure riding usually benefits from extra control and a slightly more upright front end.',
  },
  'Commuting / utility': {
    reachDeltaMm: -8,
    stackDeltaMm: 12,
    dropDeltaMm: -12,
    note: 'Utility riding often rewards comfort, visibility, and easier handling over outright speed.',
  },
  'Trail / technical fun': {
    reachDeltaMm: -2,
    stackDeltaMm: 8,
    dropDeltaMm: -10,
    note: 'Technical trail riding benefits from a slightly taller, more controllable front-end setup.',
  },
  'Downhill / gravity': {
    reachDeltaMm: -4,
    stackDeltaMm: 12,
    dropDeltaMm: -18,
    note: 'Gravity riding strongly favors control, clearance, and a less saddle-centric posture.',
  },
};

function metricConfidence(cameraValue?: number, cameraConfidence?: number, manualValue?: number): { value: number; source: 'camera' | 'manual' | 'assumed'; confidence: number } {
  if (manualValue && (!cameraValue || (cameraConfidence ?? 0) < 0.55)) {
    return { value: manualValue, source: 'manual', confidence: 0.82 };
  }
  if (cameraValue) {
    return { value: cameraValue, source: 'camera', confidence: cameraConfidence ?? 0.6 };
  }
  return { value: manualValue ?? 0, source: manualValue ? 'manual' : 'assumed', confidence: manualValue ? 0.82 : 0.35 };
}

function makeItem(key: string, label: string, value: number, spread: number, unit: string, confidence: number, explanation: string): FitRecommendationItem {
  return {
    key,
    label,
    preferred: formatValue(value, unit),
    range: formatRange(value, spread, unit),
    confidence: round(confidence, 2),
    explanation,
  };
}

export function calculateFit(state: AppState): FitResult {
  const category = BIKE_CATEGORY_CONFIG[state.bikeSelection.category];
  const rideType = RIDE_TYPE_ADJUSTMENTS[state.riderProfile.rideType];
  const camera = state.cameraEstimates;
  const issueMods = state.issues.selected.map((issue) => ISSUE_ADJUSTMENTS[issue]);
  const totalIssueReach = issueMods.reduce((sum, item) => sum + item.reachDeltaMm, 0);
  const totalIssueStack = issueMods.reduce((sum, item) => sum + item.stackDeltaMm, 0);
  const totalIssueDrop = issueMods.reduce((sum, item) => sum + item.dropDeltaMm, 0);
  const totalIssueCrank = issueMods.reduce((sum, item) => sum + item.crankDeltaMm, 0);
  const issuePenalty = issueMods.reduce((sum, item) => sum + item.confidencePenalty, 0);

  const inseam = metricConfidence(camera?.inseamCm, camera?.confidenceByMetric?.inseamCm, state.manualMeasurements.inseamCm);
  const torso = metricConfidence(camera?.torsoLengthCm, camera?.confidenceByMetric?.torsoLengthCm, state.manualMeasurements.torsoLengthCm);
  const shoulder = metricConfidence(camera?.shoulderWidthCm, camera?.confidenceByMetric?.shoulderWidthCm, state.manualMeasurements.shoulderWidthCm);
  const armSpan = metricConfidence(camera?.armSpanCm, camera?.confidenceByMetric?.armSpanCm, state.manualMeasurements.armSpanCm);

  const armEstimateCm = armSpan.value > 0 ? armSpan.value / 2 - shoulder.value / 2 : state.riderProfile.heightCm * 0.22;
  const flexibilityScore = camera?.flexibilityProxy ?? (state.riderProfile.flexibilityLevel === 'high' ? 0.75 : state.riderProfile.flexibilityLevel === 'moderate' ? 0.55 : 0.35);
  const goalFactor = state.riderProfile.ridingGoal === 'comfort' ? -1 : state.riderProfile.ridingGoal === 'endurance' ? -0.4 : state.riderProfile.ridingGoal === 'balanced' ? 0 : 0.8;

  const saddleHeightMm = inseam.value > 0
    ? inseam.value * 10 * FORMULA_COEFFICIENTS.saddleHeight.inseamFactor - FORMULA_COEFFICIENTS.saddleHeight.flexibilityPenaltyMm[state.riderProfile.flexibilityLevel]
    : state.riderProfile.heightCm * 3.9;

  const baseReachMm =
    torso.value * 10 * FORMULA_COEFFICIENTS.cockpit.torsoFactor +
    armEstimateCm * 10 * FORMULA_COEFFICIENTS.cockpit.armFactor +
    (flexibilityScore - 0.5) * FORMULA_COEFFICIENTS.cockpit.flexibilityFactor * 10 +
    goalFactor * FORMULA_COEFFICIENTS.cockpit.goalFactor +
    category.reachBiasMm +
    rideType.reachDeltaMm +
    totalIssueReach;

  const baseStackMm =
    state.riderProfile.heightCm * FORMULA_COEFFICIENTS.frame.stackFromHeight +
    (1 - flexibilityScore) * 20 +
    category.stackBiasMm +
    rideType.stackDeltaMm +
    totalIssueStack;

  const baseDropMm = clamp(category.dropBiasMm + goalFactor * 18 + (flexibilityScore - 0.5) * 30 + rideType.dropDeltaMm + totalIssueDrop, -60, 90);
  const saddleSetbackMm = clamp((inseam.value * 10 * 0.09) + (category.family === 'mtb' ? -5 : 0), 35, 95);

  let crank = 170;
  if (inseam.value > 0) {
    const [a, b, c] = FORMULA_COEFFICIENTS.crank.inseamThresholds;
    crank = inseam.value < a ? 165 : inseam.value < b ? 170 : inseam.value < c ? 172.5 : 175;
  }
  crank = clamp(crank + category.crankBiasMm + totalIssueCrank, 160, 180);

  const handlebarWidthMm = shoulder.value > 0 ? clamp(shoulder.value * 10, 360, 520) : 420;
  const stemCenterMm = clamp(avg(category.stemRangeMm) + totalIssueReach * 0.25 + goalFactor * 5 + rideType.reachDeltaMm * 0.15, category.stemRangeMm[0], category.stemRangeMm[1]);
  const effectiveTopTubeMm = round(baseReachMm + 210, 0);
  const frameSizeEstimate = round(inseam.value * 0.67, 0);

  const postureBias = (baseDropMm <= 0 || state.riderProfile.ridingGoal === 'comfort') ? 'comfort' : baseDropMm < 25 ? 'balanced' : 'aggressive';
  const commonConfidence = clamp(avg([inseam.confidence, torso.confidence, shoulder.confidence, armSpan.confidence || 0.55]) - issuePenalty, 0.25, 0.95);

  const derivedMeasurements: MeasurementValue[] = [
    { key: 'inseam', label: 'Inseam', value: round(inseam.value, 1), unit: 'cm', source: inseam.source, confidence: inseam.confidence },
    { key: 'torso', label: 'Torso length', value: round(torso.value, 1), unit: 'cm', source: torso.source, confidence: torso.confidence },
    { key: 'shoulder', label: 'Shoulder width', value: round(shoulder.value, 1), unit: 'cm', source: shoulder.source, confidence: shoulder.confidence },
    { key: 'armSpan', label: 'Arm span', value: round(armSpan.value, 1), unit: 'cm', source: armSpan.source, confidence: armSpan.confidence },
    { key: 'flexibility', label: 'Flexibility proxy', value: round(flexibilityScore, 2), source: camera?.flexibilityProxy ? 'camera' : 'assumed', confidence: camera?.confidenceByMetric?.flexibilityProxy ?? 0.5 },
  ];

  const assumptions = [
    'Absolute body dimensions are estimated using camera landmarks plus calibration scale and user-entered height checks.',
    'Recommendations are conservative starting points for new-bike sizing, not a dynamic pedaling fit.',
    'Where camera confidence was low, manual inputs or population-based defaults were weighted more heavily.',
    `Ride type "${state.riderProfile.rideType}" and terrain "${state.riderProfile.preferredTerrain}" were used as structured dropdown inputs to keep the fit logic more precise and repeatable.`,
    rideType.note,
  ];

  const warnings = [
    'This tool is an estimate, not medical advice and not a substitute for a professional bike fit.',
    ...(state.issues.selected.some((issue) => issue.includes('knee')) ? ['Knee-related complaints lower confidence and should be reviewed by a qualified fitter or clinician if symptoms persist.'] : []),
    ...(camera?.asymmetryScore && camera.asymmetryScore > 0.45 ? ['Gross asymmetry was detected in capture. Validate fit decisions with a professional fitter.'] : []),
  ];

  return {
    frameSize: makeItem('frameSize', 'Recommended frame size', frameSizeEstimate, 2, 'cm', commonConfidence, 'Frame size is primarily driven by inseam, bike category, ride type, and posture bias.'),
    effectiveTopTube: makeItem('effectiveTopTube', 'Effective top tube target', effectiveTopTubeMm, 12, 'mm', commonConfidence, 'Top tube target reflects cockpit demand from torso, arm estimate, ride type, goal, and category.'),
    stack: makeItem('stack', 'Stack target', baseStackMm, 14, 'mm', commonConfidence, 'Stack is biased by height, flexibility, category defaults, ride type, and comfort modifiers.'),
    reach: makeItem('reach', 'Reach target', baseReachMm, 10, 'mm', commonConfidence, 'Reach is weighted from torso and arm estimate, then adjusted by ride goal, ride type, and reported issues.'),
    saddleHeight: makeItem('saddleHeight', 'Saddle height', saddleHeightMm, 8, 'mm', clamp(inseam.confidence - issuePenalty * 0.3, 0.25, 0.92), 'Saddle height starts from inseam-based heuristics and is moderated by flexibility.'),
    saddleSetback: makeItem('saddleSetback', 'Saddle setback', saddleSetbackMm, 8, 'mm', clamp(inseam.confidence - 0.05, 0.25, 0.88), 'Setback is a conservative estimate based on leg length and category family.'),
    saddleToBarDrop: makeItem('saddleToBarDrop', 'Saddle-to-bar drop', baseDropMm, 10, 'mm', commonConfidence, 'Drop changes the most with category, ride type, goal, flexibility, and pain modifiers.'),
    handlebarWidth: makeItem('handlebarWidth', 'Handlebar width', handlebarWidthMm, 10, 'mm', shoulder.confidence, 'Bar width follows shoulder width with conservative clamping by common market sizes.'),
    stemLength: makeItem('stemLength', 'Stem length range center', stemCenterMm, 10, 'mm', commonConfidence, 'Stem recommendation complements frame reach and category-specific handling preferences.'),
    crankLength: makeItem('crankLength', 'Crank length', crank, 2.5, 'mm', clamp(inseam.confidence - 0.03, 0.25, 0.9), 'Crank length is based on inseam bins, then adjusted for category and hip/knee caution.'),
    seatpostSuggestion: category.usesDropper ? makeItem('seatpostSuggestion', 'Seatpost / dropper suggestion', 150, 25, 'mm', 0.75, 'MTB-oriented categories are biased toward a dropper post sized to rider inseam and frame insertion depth.') : undefined,
    postureBias,
    betweenSizesNote: postureBias === 'comfort' ? 'If between sizes, consider sizing down only if stack can still stay sufficiently high; otherwise prefer the taller front-end option.' : 'If between sizes, aggressive goals may tolerate sizing down for handling, but validate stack and saddle-to-bar drop carefully.',
    assumptions,
    warnings,
    derivedMeasurements,
  };
}
