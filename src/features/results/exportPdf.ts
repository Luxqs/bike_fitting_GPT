import jsPDF from 'jspdf';
import { AppState } from '../../types';

export function exportFitPdf(state: AppState) {
  if (!state.fitResult) return;
  const doc = new jsPDF();
  let y = 14;
  doc.setFontSize(18);
  doc.text('BikeFit Camera Summary', 14, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Rider: ${state.riderProfile.riderId || 'N/A'}`, 14, y); y += 6;
  doc.text(`Bike category: ${state.bikeSelection.category}`, 14, y); y += 8;
  doc.text('Recommendations', 14, y); y += 6;
  const items = [
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
  items.forEach((item) => {
    doc.text(`${item.label}: ${item.preferred} (${item.range})`, 14, y);
    y += 6;
  });
  y += 4;
  doc.text('Disclaimer: This is an estimation tool and should be validated by a professional fitter.', 14, y, { maxWidth: 180 });
  doc.save('bikefit-camera-summary.pdf');
}
