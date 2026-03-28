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

type MeasurementSource = 'camera' | 'manual' | 'assumed';

interface ResolvedMeasurement {
  value: number;
  source: MeasurementSource;
  confidence: number;
  usedAssumption: boolean;
  assumptionText?: string;
}

const ROAD_BAR_SIZES = [360, 380, 400, 420, 440, 460];
const FLAT_BAR_SIZES = [560, 580, 600, 620, 640, 660, 680, 700, 720, 740, 760, 780, 800];
const STEM_SIZE_STEPS = [35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130];

function snapToNearest(value: number, allowed: number[]) {
  return allowed.reduce((closest, current) =>
    Math.abs(current - value) < Math.abs(closest - value) ? current : closest,
  );
}

function assumedMeasurementsFromHeight(heightCm: number) {
  const inseamCm = round(heightCm * 0.455, 1);
  const shoulderWidthCm = clamp(round(heightCm * 0.24, 1), 36, 50);
  const armSpanCm = round(heightCm * 1.01, 1);
  const torsoLengthCm = round(heightCm * 0.305, 1);

  return {
    inseamCm,
    torsoLengthCm,
    shoulderWidthCm,
    armSpanCm,
  };
}

function resolveMeasurement(
  label: string,
  cameraValue: number | undefined,
  cameraConfidence: number | undefined,
  manualValue: number | undefined,
  assumedValue: number,
): ResolvedMeasurement {
  const hasManual = typeof manualValue === 'number' && Number.isFinite(manualValue) && manualValue > 0;
  const hasCamera = typeof cameraValue === 'number' && Number.isFinite(cameraValue) && cameraValue > 0;
  const usableCameraConfidence = cameraConfidence ?? 0;

  if (hasManual && (!hasCamera || usableCameraConfidence < 0.55)) {
    return { value: manualValue!, source: 'manual', confidence: 0.82, usedAssumption: false };
  }

  if (hasCamera) {
    return { value: cameraValue!, source: 'camera', confidence: clamp(usableCameraConfidence, 0.35, 0.92), usedAssumption: false };
  }

  if (hasManual) {
    return { value: manualValue!, source: 'manual', confidence: 0.82, usedAssumption: false };
  }

  return {
    value: assumedValue,
    source: 'assumed',
    confidence: 0.38,
    usedAssumption: true,
    assumptionText: `${label} was estimated from rider height because no reliable manual or camera value was available.`,
  };
}

function makeItem(
  key: string,
  label: string,
  value: number,
  spread: number,
  unit: string,
  confidence: number,
  explanation: string,
): FitRecommendationItem {
  return {
    key,
    label,
    preferred: formatValue(value, unit),
    range: formatRange(value, spread, unit),
    confidence: round(confidence, 2),
    explanation,
  };
}

function estimateFrameSizeCm(family: 'road' | 'gravel' | 'mtb' | 'urban' | 'bmx', inseamCm: number, heightCm: number) {
  switch (family) {
    case 'road':
      return round(inseamCm * 0.67, 0);
    case 'gravel':
      return round(inseamCm * 0.66, 0);
    case 'mtb':
      return round(inseamCm * 0.57, 0);
    case 'urban':
      return round(inseamCm * 0.63, 0);
    case 'bmx':
      return round(heightCm * 0.23, 0);
    default:
      return round(inseamCm * 0.65, 0);
  }
}

function effectiveTopTubeOffset(family: 'road' | 'gravel' | 'mtb' | 'urban' | 'bmx') {
  switch (family) {
    case 'road':
      return 210;
    case 'gravel':
      return 215;
    case 'mtb':
      return 185;
    case 'urban':
      return 200;
    case 'bmx':
      return 150;
    default:
      return 205;
  }
}

function recommendHandlebarWidthMm(
  family: 'road' | 'gravel' | 'mtb' | 'urban' | 'bmx',
  shoulderWidthCm: number,
  heightCm: number,
) {
  if (family === 'road' || family === 'gravel') {
    return snapToNearest(clamp(shoulderWidthCm * 10, 360, 460), ROAD_BAR_SIZES);
  }

  if (family === 'mtb') {
    return snapToNearest(clamp(heightCm * 3.9 + shoulderWidthCm * 2.5, 700, 800), FLAT_BAR_SIZES);
  }

  if (family === 'bmx') {
    return snapToNearest(clamp(heightCm * 4, 720, 800), FLAT_BAR_SIZES);
  }

  return snapToNearest(clamp(heightCm * 3.5, 560, 700), FLAT_BAR_SIZES);
}

function recommendDropperTravelMm(inseamCm: number) {
  if (inseamCm < 74) return 100;
  if (inseamCm < 80) return 125;
  if (inseamCm < 86) return 150;
  return 170;
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

  const assumptions: string[] = [];
  const assumed = assumedMeasurementsFromHeight(state.riderProfile.heightCm);

  const inseam = resolveMeasurement(
    'Inseam',
    camera?.inseamCm,
    camera?.confidenceByMetric?.inseamCm,
    state.manualMeasurements.inseamCm,
    assumed.inseamCm,
  );
  const torso = resolveMeasurement(
    'Torso length',
    camera?.torsoLengthCm,
    camera?.confidenceByMetric?.torsoLengthCm,
    state.manualMeasurements.torsoLengthCm,
    assumed.torsoLengthCm,
  );
  const shoulder = resolveMeasurement(
    'Shoulder width',
    camera?.shoulderWidthCm,
    camera?.confidenceByMetric?.shoulderWidthCm,
    state.manualMeasurements.shoulderWidthCm,
    assumed.shoulderWidthCm,
  );
  const armSpan = resolveMeasurement(
    'Arm span',
    camera?.armSpanCm,
    camera?.confidenceByMetric?.armSpanCm,
    state.manualMeasurements.armSpanCm,
    assumed.armSpanCm,
  );

  [inseam, torso, shoulder, armSpan]
    .filter((measurement) => measurement.usedAssumption && measurement.assumptionText)
    .forEach((measurement) => assumptions.push(measurement.assumptionText!));

  const armEstimateCm =
    armSpan.value > 0
      ? round(Math.max(armSpan.value / 2 - shoulder.value / 2, state.riderProfile.heightCm * 0.2), 1)
      : round(state.riderProfile.heightCm * 0.22, 1);

  const flexibilityScore =
    camera?.flexibilityProxy ??
    (state.riderProfile.flexibilityLevel === 'high' ? 0.78 : state.riderProfile.flexibilityLevel === 'moderate' ? 0.58 : 0.38);

  const goalFactor =
    state.riderProfile.ridingGoal === 'comfort'
      ? -1
      : state.riderProfile.ridingGoal === 'endurance'
        ? -0.35
        : state.riderProfile.ridingGoal === 'balanced'
          ? 0
          : 0.8;

  const aggressivenessFactor = category.aggressivenessBias - 0.5;

  const saddleHeightMm =
    inseam.value * 10 * FORMULA_COEFFICIENTS.saddleHeight.inseamFactor -
    FORMULA_COEFFICIENTS.saddleHeight.flexibilityPenaltyMm[state.riderProfile.flexibilityLevel];

  const baseReachMm =
    torso.value * 10 * FORMULA_COEFFICIENTS.cockpit.torsoFactor +
    armEstimateCm * 10 * FORMULA_COEFFICIENTS.cockpit.armFactor +
    (flexibilityScore - 0.5) * FORMULA_COEFFICIENTS.cockpit.flexibilityFactor * 10 +
    goalFactor * FORMULA_COEFFICIENTS.cockpit.goalFactor +
    aggressivenessFactor * 18 +
    category.reachBiasMm +
    rideType.reachDeltaMm +
    totalIssueReach;

  const baseStackMm =
    state.riderProfile.heightCm * FORMULA_COEFFICIENTS.frame.stackFromHeight +
    (1 - flexibilityScore) * 24 +
    (0.5 - category.aggressivenessBias) * 28 +
    category.stackBiasMm +
    rideType.stackDeltaMm +
    totalIssueStack;

  const baseDropMm = clamp(
    category.dropBiasMm +
      goalFactor * 18 +
      aggressivenessFactor * 16 +
      (flexibilityScore - 0.5) * 30 +
      rideType.dropDeltaMm +
      totalIssueDrop,
    -60,
    90,
  );

  const saddleSetbackMm = clamp(
    inseam.value * 10 * 0.09 + (category.family === 'mtb' ? -5 : 0) + (state.riderProfile.ridingGoal === 'comfort' ? 3 : 0),
    35,
    95,
  );

  let crank = 170;
  if (inseam.value > 0) {
    const [a, b, c] = FORMULA_COEFFICIENTS.crank.inseamThresholds;
    crank = inseam.value < a ? 165 : inseam.value < b ? 170 : inseam.value < c ? 172.5 : 175;
  }
  crank = clamp(crank + category.crankBiasMm + totalIssueCrank, 160, 180);

  const handlebarWidthMm = recommendHandlebarWidthMm(category.family, shoulder.value, state.riderProfile.heightCm);
  const stemCenterMm = snapToNearest(
    clamp(avg(category.stemRangeMm) + totalIssueReach * 0.25 + goalFactor * 5 + rideType.reachDeltaMm * 0.15, category.stemRangeMm[0], category.stemRangeMm[1]),
    STEM_SIZE_STEPS,
  );
  const effectiveTopTubeMm = round(baseReachMm + effectiveTopTubeOffset(category.family), 0);
  const frameSizeEstimate = estimateFrameSizeCm(category.family, inseam.value, state.riderProfile.heightCm);

  const postureBias =
    baseDropMm <= 0 || state.riderProfile.ridingGoal === 'comfort'
      ? 'comfort'
      : baseDropMm < 25 || category.aggressivenessBias < 0.7
        ? 'balanced'
        : 'aggressive';

  const commonConfidence = clamp(
    avg([inseam.confidence, torso.confidence, shoulder.confidence, armSpan.confidence]) - issuePenalty,
    0.25,
    0.95,
  );

  const derivedMeasurements: MeasurementValue[] = [
    { key: 'inseam', label: 'Inseam', value: round(inseam.value, 1), unit: 'cm', source: inseam.source, confidence: inseam.confidence },
    { key: 'torso', label: 'Torso length', value: round(torso.value, 1), unit: 'cm', source: torso.source, confidence: torso.confidence },
    { key: 'shoulder', label: 'Shoulder width', value: round(shoulder.value, 1), unit: 'cm', source: shoulder.source, confidence: shoulder.confidence },
    { key: 'armSpan', label: 'Arm span', value: round(armSpan.value, 1), unit: 'cm', source: armSpan.source, confidence: armSpan.confidence },
    {
      key: 'flexibility',
      label: 'Flexibility proxy',
      value: round(flexibilityScore, 2),
      source: camera?.flexibilityProxy ? 'camera' : 'assumed',
      confidence: camera?.confidenceByMetric?.flexibilityProxy ?? 0.5,
    },
  ];

  assumptions.push(
    'Absolute body dimensions are estimated using camera landmarks plus calibration scale and user-entered height checks.',
    'Recommendations are conservative starting points for new-bike sizing, not a dynamic pedaling fit.',
    'Where camera confidence was low, manual inputs or population-based defaults were weighted more heavily.',
    `Ride type "${state.riderProfile.rideType}" and terrain "${state.riderProfile.preferredTerrain}" were used as structured inputs to keep the fit logic more repeatable.`,
    rideType.note,
  );

  if (!state.calibration) {
    assumptions.push('No explicit reference-object calibration was saved, so the engine leaned more heavily on rider-height normalization.');
  }

  const warnings = [
    'This tool is an estimate, not medical advice and not a substitute for a professional bike fit.',
    ...(state.issues.selected.some((issue) => issue.includes('knee'))
      ? ['Knee-related complaints lower confidence and should be reviewed by a qualified fitter or clinician if symptoms persist.']
      : []),
    ...(camera?.asymmetryScore && camera.asymmetryScore > 0.45
      ? ['Gross asymmetry was detected in capture. Validate fit decisions with a professional fitter.']
      : []),
    ...(inseam.source === 'assumed' || torso.source === 'assumed'
      ? ['Some core body measurements were estimated from height because reliable direct inputs were missing.']
      : []),
  ];

  return {
    frameSize: makeItem(
      'frameSize',
      'Recommended frame size',
      frameSizeEstimate,
      category.family === 'mtb' || category.family === 'bmx' ? 3 : 2,
      'cm',
      commonConfidence,
      'Frame size is driven primarily by inseam, bike family, and intended posture, with separate scaling for road/gravel versus MTB-style categories.',
    ),
    effectiveTopTube: makeItem(
      'effectiveTopTube',
      'Effective top tube target',
      effectiveTopTubeMm,
      12,
      'mm',
      commonConfidence,
      'Top tube target reflects cockpit demand from torso, arm estimate, category family, ride goal, and issue-based adjustments.',
    ),
    stack: makeItem(
      'stack',
      'Stack target',
      baseStackMm,
      14,
      'mm',
      commonConfidence,
      'Stack is biased by rider height, flexibility, category aggressiveness, ride type, and comfort-related modifiers.',
    ),
    reach: makeItem(
      'reach',
      'Reach target',
      baseReachMm,
      10,
      'mm',
      commonConfidence,
      'Reach is weighted from torso and arm estimate, then adjusted by ride goal, category family, ride type, and reported issues.',
    ),
    saddleHeight: makeItem(
      'saddleHeight',
      'Saddle height',
      saddleHeightMm,
      8,
      'mm',
      clamp(inseam.confidence - issuePenalty * 0.3, 0.25, 0.92),
      'Saddle height starts from inseam-based heuristics and is moderated by flexibility.',
    ),
    saddleSetback: makeItem(
      'saddleSetback',
      'Saddle setback',
      saddleSetbackMm,
      8,
      'mm',
      clamp(inseam.confidence - 0.05, 0.25, 0.88),
      'Setback is a conservative estimate based on leg length, category family, and comfort bias.',
    ),
    saddleToBarDrop: makeItem(
      'saddleToBarDrop',
      'Saddle-to-bar drop',
      baseDropMm,
      10,
      'mm',
      commonConfidence,
      'Drop changes the most with category aggressiveness, ride type, flexibility, ride goal, and pain modifiers.',
    ),
    handlebarWidth: makeItem(
      'handlebarWidth',
      'Handlebar width',
      handlebarWidthMm,
      category.family === 'road' || category.family === 'gravel' ? 10 : 20,
      'mm',
      shoulder.confidence,
      'Bar width follows shoulder width for drop-bar bikes, while MTB, urban, and BMX families use wider flat-bar heuristics aligned with control demands.',
    ),
    stemLength: makeItem(
      'stemLength',
      'Stem length range center',
      stemCenterMm,
      10,
      'mm',
      commonConfidence,
      'Stem recommendation complements frame reach and family-specific handling preferences.',
    ),
    crankLength: makeItem(
      'crankLength',
      'Crank length',
      crank,
      2.5,
      'mm',
      clamp(inseam.confidence - 0.03, 0.25, 0.9),
      'Crank length is based on inseam bins, then adjusted for category and hip or knee caution.',
    ),
    seatpostSuggestion: category.usesDropper
      ? makeItem(
          'seatpostSuggestion',
          'Seatpost / dropper suggestion',
          recommendDropperTravelMm(inseam.value),
          25,
          'mm',
          0.75,
          'MTB-oriented categories are biased toward a dropper-post travel recommendation based on effective leg length.',
        )
      : undefined,
    postureBias,
    betweenSizesNote:
      postureBias === 'comfort'
        ? 'If between sizes, prefer the option that preserves stack and front-end comfort. For road and gravel bikes that often means the taller front-end choice; for MTB, the shorter reach choice often remains easier to manage.'
        : 'If between sizes, more aggressive goals can tolerate sizing down for handling, but validate stack and saddle-to-bar drop carefully before committing.',
    assumptions,
    warnings,
    derivedMeasurements,
  };
}
