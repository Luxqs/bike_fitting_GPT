import { ViewType } from '../types';

export type RequiredPoseId =
  | 'front-neutral'
  | 'front-tpose'
  | 'front-overhead'
  | 'side-neutral'
  | 'side-knee-lifts'
  | 'side-squat'
  | 'side-hinge'
  | 'side-seated'
  | 'side-pedal';

export interface CaptureStage {
  id: RequiredPoseId;
  title: string;
  view: ViewType;
  instruction: string;
  holdSeconds: number;
  positionTips: string[];
  optional?: boolean;
}

export const CAPTURE_PROTOCOL: CaptureStage[] = [
  {
    id: 'front-neutral',
    title: 'Neutral standing',
    view: 'front',
    instruction: 'Stand tall facing the camera, feet about shoulder-width apart, arms relaxed by your sides.',
    holdSeconds: 1.2,
    positionTips: [
      'Keep your whole body visible from head to feet.',
      'Face the camera straight on, not turned sideways.',
      'Leave a little space around your hands and feet in the frame.',
    ],
  },
  {
    id: 'front-tpose',
    title: 'T-pose',
    view: 'front',
    instruction: 'Face the camera and raise both arms out to the sides at shoulder height.',
    holdSeconds: 1.2,
    positionTips: [
      'Keep both elbows and wrists visible.',
      'Try to make your arms level with your shoulders.',
      'Stay still until the app captures automatically.',
    ],
  },
  {
    id: 'front-overhead',
    title: 'Arms overhead',
    view: 'front',
    instruction: 'Face the camera and lift both arms overhead so your hands are clearly above your head.',
    holdSeconds: 1.2,
    positionTips: [
      'Keep your body facing the camera.',
      'Do not step closer to the camera during the hold.',
      'Keep both hands inside the frame.',
    ],
  },
  {
    id: 'side-neutral',
    title: 'Neutral side stance',
    view: 'side',
    instruction: 'Turn sideways, stand tall, keep arms relaxed, and show your full body in profile.',
    holdSeconds: 1.2,
    positionTips: [
      'Turn about 90 degrees so the camera sees your side profile.',
      'Keep your feet flat on the floor.',
      'Make sure head, hips, knees, and ankles stay visible.',
    ],
  },
  {
    id: 'side-knee-lifts',
    title: 'Alternating knee lift',
    view: 'side',
    instruction: 'Turn sideways and lift one knee slowly, then hold briefly when the knee is clearly raised.',
    holdSeconds: 0.9,
    positionTips: [
      'Lift one knee enough that it is visibly higher than the other knee.',
      'Move slowly and safely.',
      'Hold the raised position briefly for automatic capture.',
    ],
  },
  {
    id: 'side-squat',
    title: 'Shallow squat',
    view: 'side',
    instruction: 'Turn sideways and perform a shallow squat with your heels on the floor.',
    holdSeconds: 1,
    positionTips: [
      'Bend both knees into a comfortable shallow squat.',
      'Keep your full body visible.',
      'Hold the squat briefly once you are steady.',
    ],
  },
  {
    id: 'side-hinge',
    title: 'Forward hip hinge',
    view: 'side',
    instruction: 'Turn sideways and hinge forward at the hips while keeping your back fairly neutral.',
    holdSeconds: 1,
    positionTips: [
      'Push your hips back slightly.',
      'Let your shoulders move forward relative to your hips.',
      'Pause once you are in the hinged position.',
    ],
  },
  {
    id: 'side-seated',
    title: 'Seated simulation',
    view: 'side',
    instruction: 'Sit sideways on a stool or box to simulate a riding posture.',
    holdSeconds: 1,
    positionTips: [
      'Sit on the edge of the stool or box.',
      'Keep your side profile visible.',
      'Pause briefly once seated.',
    ],
    optional: true,
  },
  {
    id: 'side-pedal',
    title: 'Pedaling simulation',
    view: 'side',
    instruction: 'If safe, mimic a short pedaling motion from the side and pause with one knee clearly higher.',
    holdSeconds: 0.8,
    positionTips: [
      'Keep the movement small and controlled.',
      'Stay fully inside the frame.',
      'Pause briefly with one leg more flexed than the other.',
    ],
    optional: true,
  },
];
