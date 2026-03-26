import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Field } from './components/Field';
import { WizardLayout } from './components/WizardLayout';
import { BIKE_CATEGORY_CONFIG } from './config/bikeCategories';
import { CAPTURE_PROTOCOL } from './config/captureProtocol';
import { CalibrationPanel } from './features/calibration/CalibrationPanel';
import { usePoseCapture } from './features/camera/usePoseCapture';
import { calculateFit } from './features/fit-engine/calculateFit';
import { estimateMeasurementsFromFrames } from './features/measurements/estimateMeasurements';
import { exportFitPdf } from './features/results/exportPdf';
import { useAppState } from './hooks/useAppState';
import { AppState, BikeCategory, ExperienceLevel, FlexibilityLevel, PAIN_OPTIONS, PainPoint, RidingGoal } from './types';
import './styles.css';

const MIN_CAPTURED_FRAMES = 5;

export default function App() {
  const { state, setState, nextStep, prevStep, stepIndex, totalSteps } = useAppState();
  const camera = usePoseCapture();
  const [captureIndex, setCaptureIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [capturePaused, setCapturePaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  const updateAppState = (updater: (prev: AppState) => AppState) => {
    setState(updater);
  };

  const updateRiderProfile = <K extends keyof AppState['riderProfile']>(key: K, value: AppState['riderProfile'][K]) => {
    updateAppState((prev) => ({
      ...prev,
      riderProfile: {
        ...prev.riderProfile,
        [key]: value,
      },
    }));
  };

  const updateManualMeasurement = <K extends keyof AppState['manualMeasurements']>(key: K, value: AppState['manualMeasurements'][K]) => {
    updateAppState((prev) => ({
      ...prev,
      manualMeasurements: {
        ...prev.manualMeasurements,
        [key]: value,
      },
    }));
  };

  const updateBikeSelection = <K extends keyof AppState['bikeSelection']>(key: K, value: AppState['bikeSelection'][K]) => {
    updateAppState((prev) => ({
      ...prev,
      bikeSelection: {
        ...prev.bikeSelection,
        [key]: value,
      },
    }));
  };

  const clearCaptureTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    const shouldPrepareCamera = state.step === 'camera' || state.step === 'capture';
    if (!shouldPrepareCamera || camera.isReady || camera.error || camera.isInitializing) {
      return;
    }

    let cancelled = false;
    camera
      .init()
      .then(() => {
        if (!cancelled) {
          camera.startOverlayLoop();
        }
      })
      .catch(() => {
        // Error state is stored inside the hook.
      });

    return () => {
      cancelled = true;
    };
  }, [camera, state.step]);

  useEffect(() => {
    if (state.step !== 'capture') {
      clearCaptureTimer();
      setCountdown(0);
      return;
    }

    const stage = CAPTURE_PROTOCOL[captureIndex];
    if (!stage || capturePaused) {
      clearCaptureTimer();
      return;
    }

    setCountdown(stage.seconds);
    clearCaptureTimer();
    timerRef.current = window.setInterval(() => {
      setCountdown((previousCount) => {
        if (previousCount <= 1) {
          camera.captureFrame(stage.view, stage.id);
          clearCaptureTimer();
          if (captureIndex < CAPTURE_PROTOCOL.length - 1) {
            setCaptureIndex((previousIndex) => previousIndex + 1);
          }
          return 0;
        }
        return previousCount - 1;
      });
    }, 1000);

    return () => {
      clearCaptureTimer();
    };
  }, [camera, captureIndex, capturePaused, state.step]);

  useEffect(() => {
    if (state.step === 'capture') {
      setCapturePaused(false);
    }
  }, [state.step]);

  const qualityText = useMemo(() => {
    if (camera.lastConfidence > 0.7) return 'Good';
    if (camera.lastConfidence > 0.5) return 'Okay';
    return 'Low';
  }, [camera.lastConfidence]);

  const currentStage = CAPTURE_PROTOCOL[Math.min(captureIndex, CAPTURE_PROTOCOL.length - 1)];
  const captureReady = camera.frames.length >= MIN_CAPTURED_FRAMES;

  const togglePainPoint = (painPoint: PainPoint, checked: boolean) => {
    updateAppState((previous) => {
      const withoutCurrent = previous.issues.selected.filter((item) => item !== painPoint);
      const selected = checked
        ? [...withoutCurrent.filter((item) => item !== 'No issues, just sizing a new bike'), painPoint]
        : withoutCurrent;

      return {
        ...previous,
        issues: {
          ...previous.issues,
          selected: selected.length ? selected : ['No issues, just sizing a new bike'],
        },
      };
    });
  };

  const skipCurrentStage = () => {
    if (captureIndex < CAPTURE_PROTOCOL.length - 1) {
      setCaptureIndex((previousIndex) => previousIndex + 1);
    }
  };

  const restartCaptureFlow = () => {
    clearCaptureTimer();
    setCaptureIndex(0);
    setCountdown(0);
    setCapturePaused(false);
    camera.setFrames([]);
  };

  const handleUseCapture = () => {
    const estimates = estimateMeasurementsFromFrames(camera.frames, state.calibration);
    updateAppState((previous) => ({
      ...previous,
      capturedFrames: camera.frames,
      cameraEstimates: estimates,
    }));
    nextStep();
  };

  const handleCalculateFit = () => {
    updateAppState((previous) => ({
      ...previous,
      fitResult: calculateFit(previous),
    }));
    nextStep();
  };

  const renderWelcome = () => (
    <WizardLayout
      title="BikeFit Camera"
      subtitle="Estimate comfort and performance fit dimensions for a new bike using guided camera capture and manual measurements."
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={nextStep}
      nextLabel="Start"
    >
      <div className="grid two">
        <div className="card">
          <h3>Important disclaimer</h3>
          <p>This is a comfort/performance estimation tool, not a medical device.</p>
          <p>
            Final bike selection should be validated by a professional fitter, especially if you have pain,
            injuries, asymmetries, or persistent discomfort.
          </p>
        </div>
        <div className="card">
          <h3>Privacy</h3>
          <p>Camera processing stays in the browser for this MVP. Camera frames are not uploaded by default.</p>
          <p className="helper">For best results, wear fitted clothing, use a well-lit room, and keep your full body visible.</p>
        </div>
      </div>
    </WizardLayout>
  );

  const renderProfile = () => (
    <WizardLayout title="Rider profile" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={nextStep}>
      <div className="grid four">
        <Field label="Name or rider ID" value={state.riderProfile.riderId} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('riderId', e.target.value)} />
        <Field label="Height (cm)" type="number" value={state.riderProfile.heightCm} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('heightCm', Number(e.target.value))} />
        <Field label="Weight (kg)" type="number" value={state.riderProfile.weightKg} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('weightKg', Number(e.target.value))} />
        <Field label="Shoe size" type="number" value={state.riderProfile.shoeSize} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('shoeSize', Number(e.target.value))} />
      </div>
      <div className="grid three">
        <label className="field">
          <span>Flexibility</span>
          <select value={state.riderProfile.flexibilityLevel} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('flexibilityLevel', e.target.value as FlexibilityLevel)}>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="field">
          <span>Experience</span>
          <select value={state.riderProfile.experienceLevel} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('experienceLevel', e.target.value as ExperienceLevel)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="field">
          <span>Goal</span>
          <select value={state.riderProfile.ridingGoal} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('ridingGoal', e.target.value as RidingGoal)}>
            <option value="comfort">Comfort</option>
            <option value="endurance">Endurance</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive / performance">Aggressive / performance</option>
          </select>
        </label>
      </div>
      <div className="grid three">
        <Field label="Preferred terrain" value={state.riderProfile.preferredTerrain} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('preferredTerrain', e.target.value)} />
        <Field label="Current bike type" value={state.riderProfile.currentBikeType ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('currentBikeType', e.target.value)} />
        <Field label="Current frame size" value={state.riderProfile.frameSize ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('frameSize', e.target.value)} />
      </div>
    </WizardLayout>
  );

  const renderCamera = () => (
    <WizardLayout title="Camera setup" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={nextStep}>
      <div className="grid two">
        <div className="card">
          <h3>Instructions</h3>
          <ul>
            <li>Wear fitted clothing.</li>
            <li>Show the full body in the frame.</li>
            <li>Use front and side views.</li>
            <li>Keep the camera stable at about hip-to-chest height.</li>
          </ul>
          <div className="status-row">
            <span className={`status-pill status-${qualityText.toLowerCase()}`}>Capture quality: {qualityText}</span>
            <span className="status-pill">Landmark confidence: {Math.round(camera.lastConfidence * 100)}%</span>
          </div>
          {camera.isInitializing && <p>Initializing camera and pose detector…</p>}
          {camera.error && <p>{camera.error}</p>}
        </div>
        <div className="camera-shell">
          <video ref={camera.videoRef} className="video-hidden" playsInline muted />
          <canvas ref={camera.canvasRef} className="camera-canvas" />
        </div>
      </div>
    </WizardLayout>
  );

  const renderCalibration = () => (
    <WizardLayout title="Calibration" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} disableNext>
      <CalibrationPanel
        onComplete={(calibration) => {
          updateAppState((previous) => ({ ...previous, calibration }));
          nextStep();
        }}
      />
    </WizardLayout>
  );

  const renderCapture = () => (
    <WizardLayout
      title="Guided movement capture"
      subtitle="Low-confidence frames are rejected automatically. You can pause, retry, or skip optional stages."
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onBack={prevStep}
      onNext={handleUseCapture}
      nextLabel="Use capture"
      disableNext={!captureReady}
    >
      <div className="grid two">
        <div className="card">
          <h3>{currentStage.title}</h3>
          <p>{currentStage.instruction}</p>
          <p>View: <strong>{currentStage.view}</strong></p>
          <p>Stage {captureIndex + 1} of {CAPTURE_PROTOCOL.length}</p>
          <p>Countdown: <strong>{countdown}s</strong></p>
          <p>Captured frames: <strong>{camera.frames.length}</strong></p>
          <div className="status-row">
            <span className={`status-pill status-${qualityText.toLowerCase()}`}>Capture quality: {qualityText}</span>
            {currentStage.optional && <span className="status-pill">Optional stage</span>}
          </div>
          {!captureReady && <p className="helper">Capture at least {MIN_CAPTURED_FRAMES} good frames before continuing.</p>}
          <div className="button-row">
            <button className="secondary" onClick={() => camera.captureFrame(currentStage.view, currentStage.id)}>Capture now</button>
            <button className="secondary" onClick={() => setCapturePaused((previous) => !previous)}>{capturePaused ? 'Resume countdown' : 'Pause countdown'}</button>
            {currentStage.optional && <button className="secondary" onClick={skipCurrentStage}>Skip optional stage</button>}
            <button className="secondary" onClick={restartCaptureFlow}>Retry all capture steps</button>
          </div>
        </div>
        <div className="camera-shell">
          <video ref={camera.videoRef} className="video-hidden" playsInline muted />
          <canvas ref={camera.canvasRef} className="camera-canvas" />
        </div>
      </div>
    </WizardLayout>
  );

  const renderManual = () => (
    <WizardLayout title="Manual measurements fallback" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={nextStep}>
      <div className="grid four">
        <Field label="Inseam (cm)" type="number" value={state.manualMeasurements.inseamCm ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateManualMeasurement('inseamCm', Number(e.target.value))} />
        <Field label="Arm span (cm)" type="number" value={state.manualMeasurements.armSpanCm ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateManualMeasurement('armSpanCm', Number(e.target.value))} />
        <Field label="Shoulder width (cm)" type="number" value={state.manualMeasurements.shoulderWidthCm ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateManualMeasurement('shoulderWidthCm', Number(e.target.value))} />
        <Field label="Torso length (cm)" type="number" value={state.manualMeasurements.torsoLengthCm ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateManualMeasurement('torsoLengthCm', Number(e.target.value))} />
      </div>
      <div className="card">
        <h3>Camera estimate preview</h3>
        <pre>{JSON.stringify(state.cameraEstimates, null, 2)}</pre>
      </div>
    </WizardLayout>
  );

  const renderBike = () => (
    <WizardLayout title="Bike category" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={nextStep}>
      <div className="grid three">
        <label className="field wide">
          <span>Bike category</span>
          <select value={state.bikeSelection.category} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateBikeSelection('category', e.target.value as BikeCategory)}>
            {Object.keys(BIKE_CATEGORY_CONFIG).map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <Field label="Riding style notes" value={state.bikeSelection.ridingStyleNotes ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBikeSelection('ridingStyleNotes', e.target.value)} />
      </div>
    </WizardLayout>
  );

  const renderIssues = () => (
    <WizardLayout title="Pain points and issues" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={handleCalculateFit} nextLabel="Calculate fit">
      <div className="checkbox-grid">
        {PAIN_OPTIONS.map((option) => (
          <label key={option} className="checkbox-item">
            <input type="checkbox" checked={state.issues.selected.includes(option)} onChange={(e: ChangeEvent<HTMLInputElement>) => togglePainPoint(option, Boolean(e.target.checked))} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <label className="field">
        <span>Free text notes</span>
        <textarea value={state.issues.freeText ?? ''} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateAppState((previous) => ({ ...previous, issues: { ...previous.issues, freeText: e.target.value } }))} />
      </label>
      <label className="field">
        <span>Injury / limitation notes</span>
        <textarea value={state.riderProfile.injuryNotes ?? ''} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateRiderProfile('injuryNotes', e.target.value)} />
      </label>
    </WizardLayout>
  );

  const renderResults = () => {
    const fit = state.fitResult;
    if (!fit) return null;
    const items = [
      fit.frameSize,
      fit.effectiveTopTube,
      fit.stack,
      fit.reach,
      fit.saddleHeight,
      fit.saddleSetback,
      fit.saddleToBarDrop,
      fit.handlebarWidth,
      fit.stemLength,
      fit.crankLength,
      ...(fit.seatpostSuggestion ? [fit.seatpostSuggestion] : []),
    ];

    return (
      <WizardLayout title="Results dashboard" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={() => exportFitPdf(state)} nextLabel="Export PDF">
        <div className="grid two">
          <div className="card">
            <h3>Rider summary</h3>
            <p><strong>Rider:</strong> {state.riderProfile.riderId || 'N/A'}</p>
            <p><strong>Height:</strong> {state.riderProfile.heightCm} cm</p>
            <p><strong>Goal:</strong> {state.riderProfile.ridingGoal}</p>
            <p><strong>Bike category:</strong> {state.bikeSelection.category}</p>
            <p><strong>Posture bias:</strong> {fit.postureBias}</p>
          </div>
          <div className="card warn">
            <h3>Professional fitter disclaimer</h3>
            <p>Validate final bike choice and contact points with a professional fitter, especially if you have pain, injuries, asymmetries, or recurring discomfort.</p>
          </div>
        </div>
        <div className="results-grid">
          {items.map((item) => (
            <div className="card" key={item.key}>
              <h3>{item.label}</h3>
              <div className="metric">{item.preferred}</div>
              <p>Range: {item.range}</p>
              <p>Confidence: {Math.round(item.confidence * 100)}%</p>
              <p>{item.explanation}</p>
            </div>
          ))}
        </div>
        <div className="grid two">
          <div className="card">
            <h3>Measurements summary</h3>
            {fit.derivedMeasurements.map((measurement) => (
              <p key={measurement.key}>
                {measurement.label}: <strong>{measurement.value} {measurement.unit ?? ''}</strong> · {measurement.source} · {Math.round(measurement.confidence * 100)}%
              </p>
            ))}
          </div>
          <div className="card">
            <h3>Warnings and assumptions</h3>
            {fit.warnings.map((warning, index) => <p key={index}>• {warning}</p>)}
            {fit.assumptions.map((assumption, index) => <p key={`assumption-${index}`}>• {assumption}</p>)}
            <p><strong>Between sizes:</strong> {fit.betweenSizesNote}</p>
          </div>
        </div>
      </WizardLayout>
    );
  };

  switch (state.step) {
    case 'welcome':
      return renderWelcome();
    case 'profile':
      return renderProfile();
    case 'camera':
      return renderCamera();
    case 'calibration':
      return renderCalibration();
    case 'capture':
      return renderCapture();
    case 'manual':
      return renderManual();
    case 'bike':
      return renderBike();
    case 'issues':
      return renderIssues();
    case 'results':
      return renderResults();
    default:
      return null;
  }
}
