import { CalibrationData, CameraEstimates, CapturedFrame } from '../../types';
import { avg, clamp, round } from '../../utils/math';

const dist = (a?: { x: number; y: number }, b?: { x: number; y: number }) => {
  if (!a || !b) return undefined;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const mmFromPixels = (px: number | undefined, calibration?: CalibrationData) => {
  if (!px || !calibration?.pixelsPerMm) return undefined;
  return px / calibration.pixelsPerMm;
};

const landmark = (frame: CapturedFrame, index: number) => frame.landmarks[index];

export function estimateMeasurementsFromFrames(frames: CapturedFrame[], calibration?: CalibrationData): CameraEstimates {
  const usable = frames.filter((f) => f.confidence >= 0.45 && f.landmarks.length > 20);
  const front = usable.filter((f) => f.view === 'front');
  const side = usable.filter((f) => f.view === 'side');

  const shoulderWidths = front.map((f) => mmFromPixels(dist(landmark(f, 11), landmark(f, 12)), calibration)).filter(Boolean) as number[];
  const hipWidths = front.map((f) => mmFromPixels(dist(landmark(f, 23), landmark(f, 24)), calibration)).filter(Boolean) as number[];
  const armSpans = front.map((f) => mmFromPixels(dist(landmark(f, 15), landmark(f, 16)), calibration)).filter(Boolean) as number[];

  const inseams = side.map((f) => {
    const hip = landmark(f, 24) ?? landmark(f, 23);
    const ankle = landmark(f, 28) ?? landmark(f, 27);
    return mmFromPixels(dist(hip, ankle), calibration);
  }).filter(Boolean) as number[];

  const femurs = side.map((f) => mmFromPixels(dist(landmark(f, 24) ?? landmark(f, 23), landmark(f, 26) ?? landmark(f, 25)), calibration)).filter(Boolean) as number[];
  const tibias = side.map((f) => mmFromPixels(dist(landmark(f, 26) ?? landmark(f, 25), landmark(f, 28) ?? landmark(f, 27)), calibration)).filter(Boolean) as number[];
  const torsos = side.map((f) => mmFromPixels(dist(landmark(f, 12) ?? landmark(f, 11), landmark(f, 24) ?? landmark(f, 23)), calibration)).filter(Boolean) as number[];
  const upperArms = front.map((f) => mmFromPixels(dist(landmark(f, 12) ?? landmark(f, 11), landmark(f, 14) ?? landmark(f, 13)), calibration)).filter(Boolean) as number[];
  const forearms = front.map((f) => mmFromPixels(dist(landmark(f, 14) ?? landmark(f, 13), landmark(f, 16) ?? landmark(f, 15)), calibration)).filter(Boolean) as number[];
  const feet = side.map((f) => mmFromPixels(dist(landmark(f, 29), landmark(f, 31)) ?? dist(landmark(f, 30), landmark(f, 32)), calibration)).filter(Boolean) as number[];

  const squatAngles = side.map((f) => {
    const hip = landmark(f, 24) ?? landmark(f, 23);
    const knee = landmark(f, 26) ?? landmark(f, 25);
    const ankle = landmark(f, 28) ?? landmark(f, 27);
    if (!hip || !knee || !ankle) return undefined;
    const a = Math.atan2(hip.y - knee.y, hip.x - knee.x);
    const b = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
    return Math.abs((a - b) * 180 / Math.PI);
  }).filter(Boolean) as number[];

  const asymmetry = front.length
    ? avg(front.map((f) => {
        const left = dist(landmark(f, 11), landmark(f, 15)) ?? 0;
        const right = dist(landmark(f, 12), landmark(f, 16)) ?? 0;
        return left && right ? Math.abs(left - right) / Math.max(left, right) : 0;
      }))
    : 0;

  const confidenceBase = clamp(avg(usable.map((f) => f.confidence)), 0.3, 0.95);

  return {
    inseamCm: round(avg(inseams) / 10, 1),
    femurLengthCm: round(avg(femurs) / 10, 1),
    tibiaLengthCm: round(avg(tibias) / 10, 1),
    torsoLengthCm: round(avg(torsos) / 10, 1),
    upperArmLengthCm: round(avg(upperArms) / 10, 1),
    forearmLengthCm: round(avg(forearms) / 10, 1),
    shoulderWidthCm: round(avg(shoulderWidths) / 10, 1),
    hipWidthCm: round(avg(hipWidths) / 10, 1),
    armSpanCm: round(avg(armSpans) / 10, 1),
    footLengthCm: round(avg(feet) / 10, 1),
    postureScore: round(confidenceBase, 2),
    flexibilityProxy: round(clamp((180 - avg(squatAngles)) / 120, 0.2, 0.9), 2),
    asymmetryScore: round(clamp(asymmetry, 0, 1), 2),
    confidenceByMetric: {
      inseamCm: confidenceBase,
      torsoLengthCm: confidenceBase,
      shoulderWidthCm: confidenceBase,
      armSpanCm: confidenceBase * 0.9,
      flexibilityProxy: confidenceBase * 0.8,
    },
  };
}
