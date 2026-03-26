import { useMemo, useState } from 'react';
import { AppState, StepId } from '../types';

const defaultState: AppState = {
  step: 'welcome',
  riderProfile: {
    riderId: '',
    heightCm: 175,
    weightKg: 70,
    flexibilityLevel: 'moderate',
    experienceLevel: 'intermediate',
    ridingGoal: 'balanced',
    preferredTerrain: '',
    shoeSize: 43,
  },
  manualMeasurements: {},
  capturedFrames: [],
  bikeSelection: { category: 'Endurance road' },
  issues: { selected: ['No issues, just sizing a new bike'] },
};

const order: StepId[] = ['welcome', 'profile', 'camera', 'calibration', 'capture', 'manual', 'bike', 'issues', 'results'];

export function useAppState() {
  const [state, setState] = useState<AppState>(defaultState);

  const stepIndex = useMemo(() => order.indexOf(state.step), [state.step]);

  const goToStep = (step: StepId) => setState((prev) => ({ ...prev, step }));
  const nextStep = () => setState((prev) => ({ ...prev, step: order[Math.min(order.indexOf(prev.step) + 1, order.length - 1)] }));
  const prevStep = () => setState((prev) => ({ ...prev, step: order[Math.max(order.indexOf(prev.step) - 1, 0)] }));

  return { state, setState, goToStep, nextStep, prevStep, stepIndex, totalSteps: order.length };
}
