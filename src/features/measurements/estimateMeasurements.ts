import { CalibrationData, CameraEstimates, CapturedFrame } from '../../types';
import { avg, clamp, round } from '../../utils/math';

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

function getBodyHeightPixels(frame: CapturedFrame): number | undefined {
  const visibleLandmarks = frame.landmarks.filter((point) => (point.visibility ?? 0.5) >= 0.35);
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

export function estimateMeasurementsFromFrames(frames: CapturedFrame[], calibration: CalibrationData | undefined, riderHeightCm: number): CameraEstimates {
  const usable = frames.filter((f) => f.confidence >= 0.45 && f.landmarks.length > 20);
  const front = usable.filter((f) => f.view === 'front');
  const side = usable.filter((f) => f.view === 'side');
  const { pixelsPerMm } = resolvePixelsPerMillimeter(usable, calibration, riderHeightCm);

  const shoulderWidths = front.map((f) => mmFromPixels(dist(landmark(f, 11), landmark(f, 12)), pixelsPerMm));
  const hipWidths = front.map((f) => mmFromPixels(dist(landmark(f, 23), landmark(f, 24)), pixelsPerMm));
  const armSpans = front.map((f) => mmFromPixels(dist(landmark(f, 15), landmark(f, 16)), pixelsPerMm));

  const inseams = side.map((f) => {
    const hip = landmark(f, 24) ?? landmark(f, 23);
    const ankle = landmark(f, 28) ?? landmark(f, 27);
    return mmFromPixels(dist(hip, ankle), pixelsPerMm);
  });

  const femurs = side.map((f) => mmFromPixels(dist(landmark(f, 24) ?? landmark(f, 23), landmark(f, 26) ?? landmark(f, 25)), pixelsPerMm));
  const tibias = side.map((f) => mmFromPixels(dist(landmark(f, 26) ?? landmark(f, 25), landmark(f, 28) ?? landmark(f, 27)), pixelsPerMm));
  const torsos = side.map((f) => mmFromPixels(dist(landmark(f, 12) ?? landmark(f, 11), landmark(f, 24) ?? landmark(f, 23)), pixelsPerMm));
  const upperArms = front.map((f) => mmFromPixels(dist(landmark(f, 12) ?? landmark(f, 11), landmark(f, 14) ?? landmark(f, 13)), pixelsPerMm));
  const forearms = front.map((f) => mmFromPixels(dist(landmark(f, 14) ?? landmark(f, 13), landmark(f, 16) ?? landmark(f, 15)), pixelsPerMm));
  const feet = side.map((f) => mmFromPixels(dist(landmark(f, 29), landmark(f, 31)) ?? dist(landmark(f, 30), landmark(f, 32)), pixelsPerMm));

  const squatAngles = side.map((f) => {
    const hip = landmark(f, 24) ?? landmark(f, 23);
    const knee = landmark(f, 26) ?? landmark(f, 25);
    const ankle = landmark(f, 28) ?? landmark(f, 27);
    if (!hip || !knee || !ankle) return undefined;
    const a = Math.atan2(hip.y - knee.y, hip.x - knee.x);
    const b = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
    return Math.abs((a - b) * 180 / Math.PI);
  });

  const asymmetry = front.length
    ? avg(front.map((f) => {
        const left = dist(landmark(f, 11), landmark(f, 15)) ?? 0;
        const right = dist(landmark(f, 12), landmark(f, 16)) ?? 0;
        return left && right ? Math.abs(left - right) / Math.max(left, right) : 0;
      }))
    : 0;

  const confidenceBase = clamp(avg(usable.map((f) => f.confidence)), 0.3, 0.95);
  const sideConfidence = side.length ? confidenceBase : 0.25;

  return {
    inseamCm: maybeNumber(round((averageOrUndefined(inseams) ?? 0) / 10, 1)),
    femurLengthCm: maybeNumber(round((averageOrUndefined(femurs) ?? 0) / 10, 1)),
    tibiaLengthCm: maybeNumber(round((averageOrUndefined(tibias) ?? 0) / 10, 1)),
    torsoLengthCm: maybeNumber(round((averageOrUndefined(torsos) ?? 0) / 10, 1)),
    upperArmLengthCm: maybeNumber(round((averageOrUndefined(upperArms) ?? 0) / 10, 1)),
    forearmLengthCm: maybeNumber(round((averageOrUndefined(forearms) ?? 0) / 10, 1)),
    shoulderWidthCm: maybeNumber(round((averageOrUndefined(shoulderWidths) ?? 0) / 10, 1)),
    hipWidthCm: maybeNumber(round((averageOrUndefined(hipWidths) ?? 0) / 10, 1)),
    armSpanCm: maybeNumber(round((averageOrUndefined(armSpans) ?? 0) / 10, 1)),
    footLengthCm: maybeNumber(round((averageOrUndefined(feet) ?? 0) / 10, 1)),
    postureScore: round(confidenceBase, 2),
    flexibilityProxy: round(clamp((180 - (averageOrUndefined(squatAngles) ?? 120)) / 120, 0.2, 0.9), 2),
    asymmetryScore: round(clamp(asymmetry, 0, 1), 2),
    confidenceByMetric: {
      inseamCm: sideConfidence,
      torsoLengthCm: sideConfidence,
      shoulderWidthCm: confidenceBase,
      armSpanCm: confidenceBase * 0.9,
      flexibilityProxy: side.length ? confidenceBase * 0.8 : 0.3,
    },
  };
}
