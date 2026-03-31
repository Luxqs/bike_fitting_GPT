import { useEffect, useMemo, useState } from 'react';
import { AppState, StepId } from '../types';

const STORAGE_KEY = 'bikefit-camera-state-v1';

const defaultState: AppState = {
  step: 'welcome',
  riderProfile: {
    heightCm: 175,
    flexibilityLevel: 'moderate',
    ridingGoal: 'balanced',
    rideType: 'Endurance / long rides',
    preferredTerrain: 'Paved road',
  },
  manualMeasurements: {},
  capturedFrames: [],
  bikeSelection: { category: 'Endurance road' },
  issues: { selected: ['No issues, just sizing a new bike'] },
};

const order: StepId[] = ['welcome', 'profile', 'camera', 'calibration', 'capture', 'manual', 'bike', 'issues', 'results'];

function loadInitialState(): AppState {
  if (typeof window === 'undefined') {
    return defaultState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState;
    }
    const parsed = JSON.parse(raw) as AppState;
    return {
      ...defaultState,
      ...parsed,
      riderProfile: {
        ...defaultState.riderProfile,
        ...parsed.riderProfile,
        rideType: parsed.riderProfile?.rideType || defaultState.riderProfile.rideType,
        preferredTerrain: parsed.riderProfile?.preferredTerrain || defaultState.riderProfile.preferredTerrain,
      },
      manualMeasurements: {
        ...defaultState.manualMeasurements,
        ...parsed.manualMeasurements,
      },
      bikeSelection: {
        ...defaultState.bikeSelection,
        ...parsed.bikeSelection,
      },
      issues: {
        ...defaultState.issues,
        ...parsed.issues,
      },
    };
  } catch {
    return defaultState;
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadInitialState);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const stepIndex = useMemo(() => order.indexOf(state.step), [state.step]);

  const goToStep = (step: StepId) => setState((previous) => ({ ...previous, step }));
  const nextStep = () =>
    setState((previous) => ({
      ...previous,
      step: order[Math.min(order.indexOf(previous.step) + 1, order.length - 1)],
    }));
  const prevStep = () =>
    setState((previous) => ({
      ...previous,
      step: order[Math.max(order.indexOf(previous.step) - 1, 0)],
    }));

  return { state, setState, goToStep, nextStep, prevStep, stepIndex, totalSteps: order.length };
}
