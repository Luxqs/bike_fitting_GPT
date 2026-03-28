import { CalibrationData, CameraEstimates, CapturedFrame } from '../../types';
import { avg, clamp, round } from '../../utils/math';

const FRONT_WIDTH_STAGES = new Set(['front-neutral', 'front-tpose']);
const FRONT_SPAN_STAGES = new Set(['front-tpose', 'front-overhead']);
const SIDE_LENGTH_STAGES = new Set(['side-neutral', 'side-knee-lifts', 'side-pedal']);
const SIDE_FOOT_STAGES = new Set(['side-neutral', 'side-seated']);
const FLEX_SQUAT_STAGES = new Set(['side-squat']);
const FLEX_HINGE_STAGES = new Set(['side-hinge']);
const VISIBILITY_THRESHOLD = 0.35;

const dist = (a?: { x: number; y: number }, b?: { x: number; y: number }) => {
  if (!a || !b) return undefined;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const landmark = (frame: CapturedFrame, index: number) => frame.landmarks[index];

const maybeNumber = (value?: number) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined);

const averageOrUndefined = (values: Array<number | undefined>) => {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return filtered.length ? avg(filtered) : undefined;
};

const medianOrUndefined = (values: Array<number | undefined>) => {
  const filtered = values
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (!filtered.length) {
    return undefined;
  }

  const middle = Math.floor(filtered.length / 2);
  return filtered.length % 2 === 0
    ? (filtered[middle - 1] + filtered[middle]) / 2
    : filtered[middle];
};

const maxOrUndefined = (values: Array<number | undefined>) => {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return filtered.length ? Math.max(...filtered) : undefined;
};

function getBodyHeightPixels(frame: CapturedFrame): number | undefined {
  const visibleLandmarks = frame.landmarks.filter((point) => (point.visibility ?? 0.5) >= VISIBILITY_THRESHOLD);
  if (visibleLandmarks.length < 10) {
    return undefined;
  }

  const minY = Math.min(...visibleLandmarks.map((point) => point.y));
  const maxY = Math.max(...visibleLandmarks.map((point) => point.y));
  const bodyHeightPixels = maxY - minY;
  return bodyHeightPixels > 0 ? bodyHeightPixels : undefined;
}

function resolvePixelsPerMillimeter(frames: CapturedFrame[], calibration: CalibrationData | undefined, riderHeightCm: number) {
  const bodyHeightPx = averageOrUndefined(frames.map(getBodyHeightPixels));
  const heightBasedPixelsPerMm = bodyHeightPx ? bodyHeightPx / (riderHeightCm * 10) : undefined;

  if (!calibration?.pixelsPerMm) {
    return {
      pixelsPerMm: heightBasedPixelsPerMm,
      calibrationMode: heightBasedPixelsPerMm ? 'height-reference' : 'unavailable',
    } as const;
  }

  if (!bodyHeightPx || !heightBasedPixelsPerMm) {
    return {
      pixelsPerMm: calibration.pixelsPerMm,
      calibrationMode: 'reference-object',
    } as const;
  }

  const estimatedHeightCmFromCalibration = bodyHeightPx / calibration.pixelsPerMm / 10;
  const ratio = estimatedHeightCmFromCalibration / riderHeightCm;

  if (ratio < 0.65 || ratio > 1.35) {
    return {
      pixelsPerMm: heightBasedPixelsPerMm,
      calibrationMode: 'height-corrected',
    } as const;
  }

  return {
    pixelsPerMm: calibration.pixelsPerMm,
    calibrationMode: 'reference-object',
  } as const;
}

function mmFromPixels(px: number | undefined, pixelsPerMm?: number) {
  if (!px || !pixelsPerMm) return undefined;
  return px / pixelsPerMm;
}

function selectFrames(frames: CapturedFrame[], stages: Set<string>) {
  return frames.filter((frame) => stages.has(frame.stageId));
}

function measurementConfidence(baseConfidence: number, supportingFrames: number, calibrationMode: 'reference-object' | 'height-reference' | 'height-corrected' | 'unavailable') {
  const frameBonus = Math.min(supportingFrames, 3) * 0.05;
  const calibrationPenalty =
    calibrationMode === 'reference-object'
      ? 0
      : calibrationMode === 'height-corrected'
        ? 0.08
        : calibrationMode === 'height-reference'
          ? 0.12
          : 0.2;

  return clamp(baseConfidence + frameBonus - calibrationPenalty, 0.25, 0.95);
}

export function estimateMeasurementsFromFrames(frames: CapturedFrame[], calibration: CalibrationData | undefined, riderHeightCm: number): CameraEstimates {
  const usable = frames.filter((frame) => frame.confidence >= 0.45 && frame.landmarks.length > 20);
  const front = usable.filter((frame) => frame.view === 'front');
  const side = usable.filter((frame) => frame.view === 'side');

  const frontWidths = selectFrames(front, FRONT_WIDTH_STAGES);
  const frontSpans = selectFrames(front, FRONT_SPAN_STAGES);
  const sideLengths = selectFrames(side, SIDE_LENGTH_STAGES);
  const sideFeet = selectFrames(side, SIDE_FOOT_STAGES);
  const sideSquat = selectFrames(side, FLEX_SQUAT_STAGES);
  const sideHinge = selectFrames(side, FLEX_HINGE_STAGES);

  const { pixelsPerMm, calibrationMode } = resolvePixelsPerMillimeter(usable, calibration, riderHeightCm);

  const shoulderWidths = frontWidths.map((frame) => mmFromPixels(dist(landmark(frame, 11), landmark(frame, 12)), pixelsPerMm));
  const hipWidths = frontWidths.map((frame) => mmFromPixels(dist(landmark(frame, 23), landmark(frame, 24)), pixelsPerMm));
  const armSpans = frontSpans.map((frame) => mmFromPixels(dist(landmark(frame, 15), landmark(frame, 16)), pixelsPerMm));

  const inseams = sideLengths.map((frame) => {
    const hip = landmark(frame, 24) ?? landmark(frame, 23);
    const ankle = landmark(frame, 28) ?? landmark(frame, 27);
    return mmFromPixels(dist(hip, ankle), pixelsPerMm);
  });

  const femurs = sideLengths.map((frame) =>
    mmFromPixels(dist(landmark(frame, 24) ?? landmark(frame, 23), landmark(frame, 26) ?? landmark(frame, 25)), pixelsPerMm),
  );
  const tibias = sideLengths.map((frame) =>
    mmFromPixels(dist(landmark(frame, 26) ?? landmark(frame, 25), landmark(frame, 28) ?? landmark(frame, 27)), pixelsPerMm),
  );
  const torsos = sideLengths.map((frame) =>
    mmFromPixels(dist(landmark(frame, 12) ?? landmark(frame, 11), landmark(frame, 24) ?? landmark(frame, 23)), pixelsPerMm),
  );
  const upperArms = frontWidths.map((frame) =>
    mmFromPixels(dist(landmark(frame, 12) ?? landmark(frame, 11), landmark(frame, 14) ?? landmark(frame, 13)), pixelsPerMm),
  );
  const forearms = frontWidths.map((frame) =>
    mmFromPixels(dist(landmark(frame, 14) ?? landmark(frame, 13), landmark(frame, 16) ?? landmark(frame, 15)), pixelsPerMm),
  );
  const feet = sideFeet.map((frame) =>
    mmFromPixels(dist(landmark(frame, 29), landmark(frame, 31)) ?? dist(landmark(frame, 30), landmark(frame, 32)), pixelsPerMm),
  );

  const squatAngles = sideSquat.map((frame) => {
    const hip = landmark(frame, 24) ?? landmark(frame, 23);
    const knee = landmark(frame, 26) ?? landmark(frame, 25);
    const ankle = landmark(frame, 28) ?? landmark(frame, 27);
    if (!hip || !knee || !ankle) return undefined;
    const a = Math.atan2(hip.y - knee.y, hip.x - knee.x);
    const b = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
    const angle = Math.abs(((a - b) * 180) / Math.PI);
    return angle > 180 ? 360 - angle : angle;
  });

  const hingeScores = sideHinge.map((frame) => {
    const shoulder = landmark(frame, 12) ?? landmark(frame, 11);
    const hip = landmark(frame, 24) ?? landmark(frame, 23);
    const bodyHeightPx = getBodyHeightPixels(frame);
    if (!shoulder || !hip || !bodyHeightPx) return undefined;

    return clamp((Math.abs(shoulder.x - hip.x) / bodyHeightPx - 0.05) / 0.18, 0.2, 0.9);
  });

  const squatScores = squatAngles.map((angle) => {
    if (!angle) return undefined;
    return clamp((155 - angle) / 70, 0.2, 0.9);
  });

  const frontStatic = selectFrames(front, FRONT_WIDTH_STAGES);
  const asymmetry = frontStatic.length
    ? avg(frontStatic.map((frame) => {
        const left = dist(landmark(frame, 11), landmark(frame, 15)) ?? 0;
        const right = dist(landmark(frame, 12), landmark(frame, 16)) ?? 0;
        return left && right ? Math.abs(left - right) / Math.max(left, right) : 0;
      }))
    : 0;

  const confidenceBase = clamp(avg(usable.map((frame) => frame.confidence)), 0.3, 0.95);
  const frontMetricConfidence = measurementConfidence(confidenceBase, frontWidths.length, calibrationMode);
  const armMetricConfidence = measurementConfidence(confidenceBase, frontSpans.length, calibrationMode);
  const sideMetricConfidence = measurementConfidence(confidenceBase, sideLengths.length, calibrationMode);
  const flexibilityConfidence = measurementConfidence(confidenceBase * 0.85, sideSquat.length + sideHinge.length, calibrationMode);

  return {
    inseamCm: maybeNumber(round((maxOrUndefined(inseams) ?? 0) / 10, 1)),
    femurLengthCm: maybeNumber(round((maxOrUndefined(femurs) ?? 0) / 10, 1)),
    tibiaLengthCm: maybeNumber(round((maxOrUndefined(tibias) ?? 0) / 10, 1)),
    torsoLengthCm: maybeNumber(round((maxOrUndefined(torsos) ?? 0) / 10, 1)),
    upperArmLengthCm: maybeNumber(round((maxOrUndefined(upperArms) ?? 0) / 10, 1)),
    forearmLengthCm: maybeNumber(round((maxOrUndefined(forearms) ?? 0) / 10, 1)),
    shoulderWidthCm: maybeNumber(round((medianOrUndefined(shoulderWidths) ?? 0) / 10, 1)),
    hipWidthCm: maybeNumber(round((medianOrUndefined(hipWidths) ?? 0) / 10, 1)),
    armSpanCm: maybeNumber(round((maxOrUndefined(armSpans) ?? 0) / 10, 1)),
    footLengthCm: maybeNumber(round((maxOrUndefined(feet) ?? 0) / 10, 1)),
    postureScore: round(confidenceBase, 2),
    flexibilityProxy: maybeNumber(round(averageOrUndefined([...squatScores, ...hingeScores]) ?? 0, 2)),
    asymmetryScore: round(clamp(asymmetry, 0, 1), 2),
    confidenceByMetric: {
      inseamCm: sideMetricConfidence,
      femurLengthCm: sideMetricConfidence,
      tibiaLengthCm: sideMetricConfidence,
      torsoLengthCm: sideMetricConfidence,
      shoulderWidthCm: frontMetricConfidence,
      hipWidthCm: frontMetricConfidence,
      upperArmLengthCm: frontMetricConfidence,
      forearmLengthCm: frontMetricConfidence,
      armSpanCm: armMetricConfidence,
      footLengthCm: measurementConfidence(confidenceBase * 0.8, sideFeet.length, calibrationMode),
      flexibilityProxy: flexibilityConfidence,
    },
  };
}
