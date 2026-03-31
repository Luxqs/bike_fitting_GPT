import jsPDF from 'jspdf';
import { AppState, FitRecommendationItem } from '../../types';

function getRecommendationItems(state: AppState): FitRecommendationItem[] {
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

export function exportFitPdf(state: AppState) {
  if (!state.fitResult) return;

  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const maxWidth = pageWidth - marginX * 2;
  let y = 14;

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= pageHeight - 16) {
      return;
    }
    doc.addPage();
    y = 16;
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(10);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title, marginX, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  const addParagraph = (text: string) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    ensureSpace(lines.length * 5 + 2);
    doc.text(lines, marginX, y);
    y += lines.length * 5 + 2;
  };

  const addBulletList = (items: string[]) => {
    items.forEach((item) => addParagraph(`• ${item}`));
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('BikeFit Camera Summary', marginX, y);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  addParagraph('Rider profile: camera-guided assessment');
  addParagraph(`Bike category: ${state.bikeSelection.category}`);
  addParagraph(`Ride type: ${state.riderProfile.rideType}`);
  addParagraph(`Terrain: ${state.riderProfile.preferredTerrain}`);
  addParagraph(`Posture bias: ${state.fitResult.postureBias}`);

  addSectionTitle('Recommended dimensions');
  getRecommendationItems(state).forEach((item) => {
    addParagraph(`${item.label}: ${item.preferred} (range ${item.range}, confidence ${Math.round(item.confidence * 100)}%)`);
  });

  addSectionTitle('Measurement summary');
  state.fitResult.derivedMeasurements.forEach((measurement) => {
    addParagraph(
      `${measurement.label}: ${measurement.value}${measurement.unit ? ` ${measurement.unit}` : ''} · source: ${measurement.source} · confidence ${Math.round(measurement.confidence * 100)}%`,
    );
  });

  addSectionTitle('Why these values were recommended');
  getRecommendationItems(state).forEach((item) => {
    addParagraph(`${item.label}: ${item.explanation}`);
  });

  addSectionTitle('Assumptions');
  addBulletList(state.fitResult.assumptions);

  addSectionTitle('Warnings');
  addBulletList([
    ...state.fitResult.warnings,
    'Validate final bike choice and contact points with a professional fitter, especially if you have pain, injuries, asymmetries, or recurring discomfort.',
  ]);

  doc.save('bikefit-camera-summary.pdf');
}
