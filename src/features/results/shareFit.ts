import { AppState, FitRecommendationItem } from '../../types';

function getPrimaryItems(state: AppState): FitRecommendationItem[] {
  if (!state.fitResult) {
    return [];
  }

  return [
    state.fitResult.frameSize,
    state.fitResult.effectiveTopTube,
    state.fitResult.stack,
    state.fitResult.reach,
    state.fitResult.saddleHeight,
    state.fitResult.saddleSetback,
    state.fitResult.saddleToBarDrop,
    state.fitResult.handlebarWidth,
    state.fitResult.stemLength,
    state.fitResult.crankLength,
    ...(state.fitResult.seatpostSuggestion ? [state.fitResult.seatpostSuggestion] : []),
  ];
}

export function buildFitShareText(state: AppState): string {
  if (!state.fitResult) {
    return 'BikeFit Camera summary is not available yet.';
  }

  const lines = [
    'BikeFit Camera summary',
    `Bike category: ${state.bikeSelection.category}`,
    `Ride type: ${state.riderProfile.rideType}`,
    `Terrain: ${state.riderProfile.preferredTerrain}`,
    '',
    'Recommended measurements:',
    ...getPrimaryItems(state).map((item) => `- ${item.label}: ${item.preferred} (range ${item.range})`),
    '',
    `Posture bias: ${state.fitResult.postureBias}`,
    `Between sizes note: ${state.fitResult.betweenSizesNote}`,
    '',
    'Important: This is an estimate and should be validated by a professional fitter.',
  ];

  return lines.join('\n');
}

export function buildMailtoUrl(state: AppState): string {
  const subject = 'BikeFit Camera fit summary';
  const body = buildFitShareText(state);
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildWhatsAppUrl(state: AppState): string {
  const text = buildFitShareText(state);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function shareViaWebShare(state: AppState): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return false;
  }

  await navigator.share({
    title: 'BikeFit Camera summary',
    text: buildFitShareText(state),
  });
  return true;
}
