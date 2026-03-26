export type StepId = 'welcome' | 'profile' | 'camera' | 'calibration' | 'capture' | 'manual' | 'bike' | 'issues' | 'results';
export type ViewType = 'front' | 'side';

export type BikeCategory =
  | 'Road race'
  | 'Endurance road'
  | 'Aero road'
  | 'Climbing road'
  | 'Time trial / Triathlon'
  | 'Gravel race'
  | 'Gravel adventure'
  | 'Cyclocross'
  | 'MTB XC'
  | 'MTB Trail'
  | 'MTB All-mountain'
  | 'MTB Enduro'
  | 'MTB Downhill'
  | 'MTB Hardtail'
  | 'MTB Full-suspension'
  | 'Hybrid / Fitness'
  | 'Commuter / City'
  | 'Touring'
  | 'Bikepacking'
  | 'BMX / Dirt jump';

export type FlexibilityLevel = 'low' | 'moderate' | 'high';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type RidingGoal = 'comfort' | 'endurance' | 'balanced' | 'aggressive / performance';

export type PainPoint =
  | 'Front knee pain'
  | 'Back of knee pain'
  | 'Low back pain'
  | 'Neck pain'
  | 'Hand numbness / wrist pain'
  | 'Shoulder pain'
  | 'Saddle discomfort'
  | 'Hip tightness / hip pain'
  | 'Foot numbness'
  | 'Feeling too stretched'
  | 'Feeling too cramped'
  | 'Instability / poor control'
  | 'No issues, just sizing a new bike';

export interface RiderProfile {
  riderId: string;
  ageRange?: string;
  biologicalSex?: string;
  heightCm: number;
  weightKg: number;
  flexibilityLevel: FlexibilityLevel;
  experienceLevel: ExperienceLevel;
  ridingGoal: RidingGoal;
  preferredTerrain: string;
  shoeSize: number;
  currentBikeType?: string;
  frameSize?: string;
  stemLengthMm?: number;
  handlebarWidthMm?: number;
  crankLengthMm?: number;
  saddleHeightMm?: number;
  reachMm?: number;
  dropMm?: number;
  injuryNotes?: string;
}

export interface ManualMeasurements {
  inseamCm?: number;
  armSpanCm?: number;
  shoulderWidthCm?: number;
  torsoLengthCm?: number;
}

export interface CalibrationData {
  method: 'a4' | 'credit-card' | 'aruco' | 'manual';
  referenceWidthMm: number;
  pixelsPerMm: number;
  confidence: number;
  notes?: string;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface CapturedFrame {
  timestamp: number;
  view: ViewType;
  stageId: string;
  landmarks: LandmarkPoint[];
  confidence: number;
}

export interface CameraEstimates {
  inseamCm?: number;
  femurLengthCm?: number;
  tibiaLengthCm?: number;
  torsoLengthCm?: number;
  upperArmLengthCm?: number;
  forearmLengthCm?: number;
  shoulderWidthCm?: number;
  hipWidthCm?: number;
  armSpanCm?: number;
  footLengthCm?: number;
  postureScore?: number;
  flexibilityProxy?: number;
  asymmetryScore?: number;
  confidenceByMetric?: Record<string, number>;
}

export interface BikeSelection {
  category: BikeCategory;
  ridingStyleNotes?: string;
}

export interface IssueSelection {
  selected: PainPoint[];
  freeText?: string;
}

export interface MeasurementValue {
  key: string;
  label: string;
  value: number;
  unit?: string;
  source: 'camera' | 'manual' | 'assumed';
  confidence: number;
}

export interface FitRecommendationItem {
  key: string;
  label: string;
  preferred: string;
  range: string;
  confidence: number;
  explanation: string;
}

export interface FitResult {
  frameSize: FitRecommendationItem;
  effectiveTopTube: FitRecommendationItem;
  stack: FitRecommendationItem;
  reach: FitRecommendationItem;
  saddleHeight: FitRecommendationItem;
  saddleSetback: FitRecommendationItem;
  saddleToBarDrop: FitRecommendationItem;
  handlebarWidth: FitRecommendationItem;
  stemLength: FitRecommendationItem;
  crankLength: FitRecommendationItem;
  seatpostSuggestion?: FitRecommendationItem;
  postureBias: 'comfort' | 'balanced' | 'aggressive';
  betweenSizesNote: string;
  assumptions: string[];
  warnings: string[];
  derivedMeasurements: MeasurementValue[];
}

export interface AppState {
  step: StepId;
  riderProfile: RiderProfile;
  manualMeasurements: ManualMeasurements;
  calibration?: CalibrationData;
  capturedFrames: CapturedFrame[];
  cameraEstimates?: CameraEstimates;
  bikeSelection: BikeSelection;
  issues: IssueSelection;
  fitResult?: FitResult;
}

export const PAIN_OPTIONS: PainPoint[] = [
  'Front knee pain',
  'Back of knee pain',
  'Low back pain',
  'Neck pain',
  'Hand numbness / wrist pain',
  'Shoulder pain',
  'Saddle discomfort',
  'Hip tightness / hip pain',
  'Foot numbness',
  'Feeling too stretched',
  'Feeling too cramped',
  'Instability / poor control',
  'No issues, just sizing a new bike',
];
