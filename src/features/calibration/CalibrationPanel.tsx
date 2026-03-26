import { ChangeEvent, useMemo, useState } from 'react';
import { CalibrationData } from '../../types';

interface Props {
  onComplete: (data: CalibrationData) => void;
}

const DEFAULT_REFERENCE_WIDTH_MM: Record<CalibrationData['method'], number> = {
  a4: 210,
  'credit-card': 85.6,
  aruco: 50,
  manual: 100,
};

export function CalibrationPanel({ onComplete }: Props) {
  const [method, setMethod] = useState<CalibrationData['method']>('a4');
  const [pixelWidth, setPixelWidth] = useState(210);
  const [manualReferenceWidthMm, setManualReferenceWidthMm] = useState(DEFAULT_REFERENCE_WIDTH_MM.manual);

  const referenceWidthMm = useMemo(() => {
    if (method === 'manual') {
      return manualReferenceWidthMm;
    }
    return DEFAULT_REFERENCE_WIDTH_MM[method];
  }, [manualReferenceWidthMm, method]);

  const canSave = pixelWidth > 0 && referenceWidthMm > 0;

  return (
    <div className="card">
      <h2>Calibration</h2>
      <p>
        Place a known reference object in roughly the same plane as your body. This MVP uses manual alignment when
        automatic detection is unavailable.
      </p>
      <label className="field">
        <span>Reference object</span>
        <select value={method} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMethod(e.target.value as CalibrationData['method'])}>
          <option value="a4">A4 sheet (210 mm width)</option>
          <option value="credit-card">Credit card (85.6 mm width)</option>
          <option value="aruco">ArUco marker (50 mm example)</option>
          <option value="manual">Manual ruler / custom object</option>
        </select>
      </label>
      {method === 'manual' && (
        <label className="field">
          <span>Manual reference width (mm)</span>
          <input type="number" min={1} value={manualReferenceWidthMm} onChange={(e: ChangeEvent<HTMLInputElement>) => setManualReferenceWidthMm(Number(e.target.value))} />
        </label>
      )}
      <label className="field">
        <span>Measured width in preview pixels</span>
        <input type="number" min={1} value={pixelWidth} onChange={(e: ChangeEvent<HTMLInputElement>) => setPixelWidth(Number(e.target.value))} />
      </label>
      <p className="helper">Tip: hold the object flat to the camera and keep it near the rider plane to reduce scale error.</p>
      <button
        disabled={!canSave}
        onClick={() =>
          onComplete({
            method,
            referenceWidthMm,
            pixelsPerMm: pixelWidth / referenceWidthMm,
            confidence: method === 'manual' ? 0.62 : 0.72,
            notes: method === 'manual' ? 'Manual custom-object calibration used.' : 'Manual alignment calibration used.',
          })
        }
      >
        Save calibration
      </button>
    </div>
  );
}
