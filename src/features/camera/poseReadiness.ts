import { CaptureStage } from '../../config/captureProtocol';
import { LandmarkPoint } from '../../types';

interface FrameSize {
  width: number;
  height: number;
}

export interface PoseReadinessResult {
  ready: boolean;
  checks: Array<{ label: string; passed: boolean }>;
  hint: string;
  guidance: string[];
}

const VISIBILITY_THRESHOLD = 0.35;

const point = (landmarks: LandmarkPoint[], index: number) => landmarks[index];

const distance = (a?: LandmarkPoint, b?: LandmarkPoint) => {
  if (!a || !b) return undefined;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const visible = (landmarks: LandmarkPoint[], index: number, frameSize: FrameSize) => {
  const landmark = point(landmarks, index);
  if (!landmark) return false;
  const marginX = frameSize.width * 0.03;
  const marginY = frameSize.height * 0.03;
  return (
    (landmark.visibility ?? 0.5) >= VISIBILITY_THRESHOLD &&
    landmark.x > marginX &&
    landmark.x < frameSize.width - marginX &&
    landmark.y > marginY &&
    landmark.y < frameSize.height - marginY
  );
};

const averageY = (...values: Array<number | undefined>) => {
  const filtered = values.filter((value): value is number => typeof value === 'number');
  if (!filtered.length) return undefined;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
};

const averageX = (...values: Array<number | undefined>) => {
  const filtered = values.filter((value): value is number => typeof value === 'number');
  if (!filtered.length) return undefined;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
};

function bodyHeight(landmarks: LandmarkPoint[]) {
  const visibleLandmarks = landmarks.filter((landmark) => (landmark.visibility ?? 0.5) >= VISIBILITY_THRESHOLD);
  if (visibleLandmarks.length < 8) return undefined;
  const minY = Math.min(...visibleLandmarks.map((landmark) => landmark.y));
  const maxY = Math.max(...visibleLandmarks.map((landmark) => landmark.y));
  return maxY - minY;
}

function getOrientationCheck(landmarks: LandmarkPoint[], frameSize: FrameSize, stage: CaptureStage) {
  const shoulderWidth = distance(point(landmarks, 11), point(landmarks, 12));
  const hipWidth = distance(point(landmarks, 23), point(landmarks, 24));
  const height = bodyHeight(landmarks) ?? frameSize.height;
  const shoulderRatio = shoulderWidth ? shoulderWidth / height : 0;
  const hipRatio = hipWidth ? hipWidth / height : 0;

  if (stage.view === 'front') {
    return {
      passed: shoulderRatio > 0.12 && hipRatio > 0.08,
      label: 'Face the camera front-on',
      instruction: 'Face the camera more directly.',
    };
  }

  return {
    passed: shoulderRatio < 0.14 && hipRatio < 0.1,
    label: 'Turn sideways to the camera',
    instruction: 'Turn your body more sideways to the camera.',
  };
}

function evaluateStageSpecificChecks(stage: CaptureStage, landmarks: LandmarkPoint[], height: number) {
  const leftShoulder = point(landmarks, 11);
  const rightShoulder = point(landmarks, 12);
  const leftWrist = point(landmarks, 15);
  const rightWrist = point(landmarks, 16);
  const leftHip = point(landmarks, 23);
  const rightHip = point(landmarks, 24);
  const leftKnee = point(landmarks, 25);
  const rightKnee = point(landmarks, 26);
  const leftAnkle = point(landmarks, 27);
  const rightAnkle = point(landmarks, 28);
  const nose = point(landmarks, 0);

  const shoulderY = averageY(leftShoulder?.y, rightShoulder?.y) ?? 0;
  const wristY = averageY(leftWrist?.y, rightWrist?.y) ?? 0;
  const wristSpan = distance(leftWrist, rightWrist) ?? 0;
  const shoulderSpan = distance(leftShoulder, rightShoulder) ?? 0;
  const hipY = averageY(leftHip?.y, rightHip?.y) ?? 0;
  const kneeY = averageY(leftKnee?.y, rightKnee?.y) ?? 0;
  const ankleY = averageY(leftAnkle?.y, rightAnkle?.y) ?? 0;
  const shoulderX = averageX(leftShoulder?.x, rightShoulder?.x) ?? 0;
  const hipX = averageX(leftHip?.x, rightHip?.x) ?? 0;

  switch (stage.id) {
    case 'front-neutral':
      return [{ label: 'Keep both arms relaxed at your sides', passed: wristY > shoulderY + height * 0.12, instruction: 'Relax your arms and let your hands hang below your shoulders.' }];
    case 'front-tpose':
      return [
        { label: 'Raise both arms to shoulder height', passed: Math.abs(wristY - shoulderY) < height * 0.12, instruction: 'Raise both arms until they are level with your shoulders.' },
        { label: 'Stretch arms wide left and right', passed: wristSpan > Math.max(shoulderSpan * 1.9, height * 0.55), instruction: 'Move your hands farther away from your body.' },
      ];
    case 'front-overhead':
      return [
        { label: 'Lift both hands above your head', passed: wristY < shoulderY - height * 0.12, instruction: 'Lift both hands higher above your head.' },
        { label: 'Keep hands clearly above your head', passed: nose ? wristY < nose.y - height * 0.04 : true, instruction: 'Keep your hands clearly above your head and inside the frame.' },
      ];
    case 'side-neutral':
      return [{ label: 'Stand upright in side profile', passed: wristY > shoulderY + height * 0.1, instruction: 'Stand tall in a clean side profile.' }];
    case 'side-knee-lifts':
      return [{ label: 'Lift one knee clearly higher', passed: Math.abs((leftKnee?.y ?? 0) - (rightKnee?.y ?? 0)) > height * 0.08, instruction: 'Lift one knee higher and hold still for a moment.' }];
    case 'side-squat':
      return [{ label: 'Move into a shallow squat', passed: hipY > shoulderY + height * 0.28 && hipY > kneeY - height * 0.18, instruction: 'Lower into a comfortable shallow squat.' }];
    case 'side-hinge':
      return [{ label: 'Hinge forward at the hips', passed: Math.abs(shoulderX - hipX) > height * 0.08 && shoulderY < hipY, instruction: 'Push your hips back and bend forward at the hips.' }];
    case 'side-seated':
      return [{ label: 'Sit with bent hips and knees', passed: Math.abs(hipY - kneeY) < height * 0.2 && kneeY < ankleY, instruction: 'Sit on the stool or box and pause once stable.' }];
    case 'side-pedal':
      return [{ label: 'Pause with one knee more flexed', passed: Math.abs((leftKnee?.y ?? 0) - (rightKnee?.y ?? 0)) > height * 0.08, instruction: 'Pause with one knee more bent than the other.' }];
    default:
      return [];
  }
}

function buildFramingGuidance(landmarks: LandmarkPoint[], frameSize: FrameSize) {
  const guidance = new Set<string>();
  const estimatedHeight = bodyHeight(landmarks);
  const heightRatio = estimatedHeight ? estimatedHeight / frameSize.height : undefined;

  const headVisible = visible(landmarks, 0, frameSize);
  const leftHandVisible = visible(landmarks, 15, frameSize);
  const rightHandVisible = visible(landmarks, 16, frameSize);
  const leftFootVisible = visible(landmarks, 27, frameSize);
  const rightFootVisible = visible(landmarks, 28, frameSize);

  if (!headVisible || !leftFootVisible || !rightFootVisible) {
    guidance.add('Go farther away from the camera until your full body is visible from head to feet.');
  }
  if (!leftHandVisible || !rightHandVisible) {
    guidance.add('Move your hands away from your body and keep both hands inside the frame.');
  }
  if (!leftFootVisible || !rightFootVisible) {
    guidance.add('The app cannot see your legs and feet clearly. Step back or tilt the camera down slightly.');
  }
  if (heightRatio && heightRatio > 0.9) {
    guidance.add('Go a little farther away from the camera. Your body is too large in the frame.');
  }
  if (heightRatio && heightRatio < 0.5) {
    guidance.add('Move a little closer to the camera so your body fills more of the frame.');
  }

  return guidance;
}

export function evaluatePoseReadiness(
  stage: CaptureStage,
  landmarks: LandmarkPoint[],
  frameSize: FrameSize | null,
): PoseReadinessResult {
  if (!frameSize || landmarks.length < 20) {
    return {
      ready: false,
      checks: [
        { label: 'Step fully into the frame', passed: false },
        { label: `Prepare the ${stage.view} view`, passed: false },
      ],
      hint: 'Make sure your whole body is visible and the camera can see you clearly.',
      guidance: ['Move into the frame until your whole body is visible.'],
    };
  }

  const fullBodyCheck = {
    label: 'Keep head, hands, hips, knees, and feet visible',
    passed:
      visible(landmarks, 0, frameSize) &&
      visible(landmarks, 15, frameSize) &&
      visible(landmarks, 16, frameSize) &&
      visible(landmarks, 23, frameSize) &&
      visible(landmarks, 24, frameSize) &&
      visible(landmarks, 27, frameSize) &&
      visible(landmarks, 28, frameSize),
  };

  const orientationCheck = getOrientationCheck(landmarks, frameSize, stage);
  const height = bodyHeight(landmarks) ?? frameSize.height;
  const stageChecks = evaluateStageSpecificChecks(stage, landmarks, height);
  const checks = [fullBodyCheck, { label: orientationCheck.label, passed: orientationCheck.passed }, ...stageChecks.map((check) => ({ label: check.label, passed: check.passed }))];

  const guidance = buildFramingGuidance(landmarks, frameSize);
  if (!orientationCheck.passed) {
    guidance.add(orientationCheck.instruction);
  }
  stageChecks.filter((check) => !check.passed).forEach((check) => guidance.add(check.instruction));

  const guidanceList = Array.from(guidance);
  const ready = checks.every((check) => check.passed);

  return {
    ready,
    checks,
    hint: ready ? 'Good position detected. Hold still for automatic capture.' : guidanceList[0] ?? 'Adjust your position until all checklist items are green.',
    guidance: guidanceList,
  };
}
