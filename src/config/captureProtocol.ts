import { ViewType } from '../types';

export interface CaptureStage {
  id: string;
  title: string;
  view: ViewType;
  instruction: string;
  seconds: number;
  optional?: boolean;
}

export const CAPTURE_PROTOCOL: CaptureStage[] = [
  { id: 'front-neutral', title: 'Neutral standing', view: 'front', instruction: 'Stand tall, feet shoulder-width apart, arms relaxed.', seconds: 4 },
  { id: 'front-tpose', title: 'T-pose', view: 'front', instruction: 'Raise both arms sideways to shoulder height.', seconds: 4 },
  { id: 'front-overhead', title: 'Arms overhead', view: 'front', instruction: 'Lift both arms overhead and keep elbows visible.', seconds: 4 },
  { id: 'side-neutral', title: 'Neutral side stance', view: 'side', instruction: 'Turn sideways, stand tall, arms relaxed.', seconds: 4 },
  { id: 'side-knee-lifts', title: 'Alternating knee lift', view: 'side', instruction: 'Lift left knee slightly, then right knee. Move slowly.', seconds: 6 },
  { id: 'side-squat', title: 'Shallow squat', view: 'side', instruction: 'Perform a shallow squat with heels down.', seconds: 5 },
  { id: 'side-hinge', title: 'Forward hip hinge', view: 'side', instruction: 'Bend forward at the hips with a neutral spine.', seconds: 5 },
  { id: 'side-seated', title: 'Seated simulation', view: 'side', instruction: 'Sit on a stool or box to simulate riding posture.', seconds: 5, optional: true },
  { id: 'side-pedal', title: 'Pedaling simulation', view: 'side', instruction: 'Optional short pedaling motion if safely possible.', seconds: 5, optional: true },
];
