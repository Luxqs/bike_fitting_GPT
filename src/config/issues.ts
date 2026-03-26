import { PainPoint } from '../types';

export interface IssueAdjustment {
  reachDeltaMm: number;
  stackDeltaMm: number;
  dropDeltaMm: number;
  crankDeltaMm: number;
  confidencePenalty: number;
  notes: string;
}

export const ISSUE_ADJUSTMENTS: Record<PainPoint, IssueAdjustment> = {
  'Front knee pain': { reachDeltaMm: 0, stackDeltaMm: 0, dropDeltaMm: 0, crankDeltaMm: -2.5, confidencePenalty: 0.12, notes: 'Knee pain reduces confidence and nudges toward conservative crank and setup assumptions.' },
  'Back of knee pain': { reachDeltaMm: 0, stackDeltaMm: 0, dropDeltaMm: 0, crankDeltaMm: -2.5, confidencePenalty: 0.12, notes: 'Posterior knee issues reduce confidence and justify professional review.' },
  'Low back pain': { reachDeltaMm: -10, stackDeltaMm: 12, dropDeltaMm: -10, crankDeltaMm: 0, confidencePenalty: 0.06, notes: 'Low back complaints bias toward a shorter, taller front end.' },
  'Neck pain': { reachDeltaMm: -8, stackDeltaMm: 12, dropDeltaMm: -12, crankDeltaMm: 0, confidencePenalty: 0.06, notes: 'Neck issues bias toward reduced drop and shorter reach.' },
  'Hand numbness / wrist pain': { reachDeltaMm: -6, stackDeltaMm: 10, dropDeltaMm: -8, crankDeltaMm: 0, confidencePenalty: 0.05, notes: 'Hand pressure often improves with less aggressive weight distribution.' },
  'Shoulder pain': { reachDeltaMm: -8, stackDeltaMm: 6, dropDeltaMm: -6, crankDeltaMm: 0, confidencePenalty: 0.05, notes: 'Shoulder pain shifts cockpit recommendations shorter and slightly higher.' },
  'Saddle discomfort': { reachDeltaMm: 0, stackDeltaMm: 0, dropDeltaMm: 0, crankDeltaMm: 0, confidencePenalty: 0.04, notes: 'Saddle discomfort increases caution around setback and height assumptions.' },
  'Hip tightness / hip pain': { reachDeltaMm: -4, stackDeltaMm: 6, dropDeltaMm: -4, crankDeltaMm: -5, confidencePenalty: 0.08, notes: 'Hip tightness suggests a slightly more open hip angle and shorter crank.' },
  'Foot numbness': { reachDeltaMm: 0, stackDeltaMm: 0, dropDeltaMm: 0, crankDeltaMm: -2.5, confidencePenalty: 0.05, notes: 'Foot symptoms lower confidence and bias away from over-long cranks.' },
  'Feeling too stretched': { reachDeltaMm: -12, stackDeltaMm: 8, dropDeltaMm: -8, crankDeltaMm: 0, confidencePenalty: 0.03, notes: 'Self-reported long cockpit feeling biases shorter cockpit recommendations.' },
  'Feeling too cramped': { reachDeltaMm: 10, stackDeltaMm: -4, dropDeltaMm: 4, crankDeltaMm: 0, confidencePenalty: 0.03, notes: 'Cramped feeling biases slightly longer cockpit assumptions.' },
  'Instability / poor control': { reachDeltaMm: -4, stackDeltaMm: 4, dropDeltaMm: -4, crankDeltaMm: 0, confidencePenalty: 0.05, notes: 'Control complaints bias toward stability-focused fit choices.' },
  'No issues, just sizing a new bike': { reachDeltaMm: 0, stackDeltaMm: 0, dropDeltaMm: 0, crankDeltaMm: 0, confidencePenalty: 0, notes: 'No issue-based modifier applied.' },
};
