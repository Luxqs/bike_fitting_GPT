import { useState } from 'react';
import { CalibrationData } from '../../types';

interface Props {
  onComplete: (data: CalibrationData) => void;
}

export function CalibrationPanel({ onComplete }: Props) {
  const [method, setMethod] = useState<CalibrationData['method']>('a4');
  const [pixelWidth, setPixelWidth] = useState(210);

  const referenceWidthMm = method === 'a4' ? 210 : method === 'credit-card' ? 85.6 : method === 'aruco' ? 50 : 100;

  return (
    <div className="card">
      <h2>Calibration</h2>
      <p>Place a known reference object in roughly the same plane as your body. This MVP uses manual alignment when automatic detection is unavailable.</p>
      <label className="field">
        <span>Reference object</span>
        <select value={method} onChange={(e) => setMethod(e.target.value as CalibrationData['method'])}>
          <option value="a4">A4 sheet (210 mm width)</option>
          <option value="credit-card">Credit card (85.6 mm width)</option>
          <option value="aruco">ArUco marker (50 mm example)</option>
          <option value="manual">Manual ruler / object</option>
        </select>
      </label>
      <label className="field">
        <span>Measured width in preview pixels</span>
        <input type="number" value={pixelWidth} onChange={(e) => setPixelWidth(Number(e.target.value))} />
      </label>
      <button onClick={() => onComplete({ method, referenceWidthMm, pixelsPerMm: pixelWidth / referenceWidthMm, confidence: 0.72, notes: 'Manual alignment calibration used.' })}>Save calibration</button>
    </div>
  );
}
