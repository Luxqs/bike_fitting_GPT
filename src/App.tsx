import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Field } from './components/Field';
import { WizardLayout } from './components/WizardLayout';
import {
  AGE_RANGE_OPTIONS,
  BIKE_CATEGORY_GROUPS,
  BIOLOGICAL_SEX_OPTIONS,
  CURRENT_BIKE_TYPE_OPTIONS,
  RIDE_TYPE_OPTIONS,
  TERRAIN_OPTIONS,
} from './config/dropdownOptions';
import { CAPTURE_PROTOCOL } from './config/captureProtocol';
import { CalibrationPanel } from './features/calibration/CalibrationPanel';
import { CaptureGuideOverlay } from './features/camera/CaptureGuideOverlay';
import { evaluatePoseReadiness } from './features/camera/poseReadiness';
import { usePoseCapture } from './features/camera/usePoseCapture';
import { calculateFit } from './features/fit-engine/calculateFit';
import { estimateMeasurementsFromFrames } from './features/measurements/estimateMeasurements';
import { exportFitPdf } from './features/results/exportPdf';
import { buildMailtoUrl, buildWhatsAppUrl, shareViaWebShare } from './features/results/shareFit';
import { useAppState } from './hooks/useAppState';
import { AppState, BikeCategory, ExperienceLevel, FlexibilityLevel, PAIN_OPTIONS, PainPoint, RidingGoal } from './types';
import './styles.css';

const MIN_CAPTURED_FRAMES = 5;
const REQUIRED_STAGE_IDS = ['front-neutral', 'front-tpose', 'side-neutral', 'side-squat', 'side-hinge'] as const;

export default function App() {
  const { state, setState, nextStep, prevStep, stepIndex, totalSteps } = useAppState();
  const camera = usePoseCapture();
  const [captureIndex, setCaptureIndex] = useState(0);
  const [capturePaused, setCapturePaused] = useState(false);
  const [holdProgressMs, setHoldProgressMs] = useState(0);
  const [shareStatus, setShareStatus] = useState<string>('');
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
  }, [camera.error, camera.init, camera.isInitializing, camera.isReady, camera.startOverlayLoop, state.step]);

  useEffect(() => {
    if (state.step !== 'capture') {
      clearCaptureTimer();
      setHoldProgressMs(0);
    }
  }, [state.step]);

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
  const webShareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const stageReadiness = useMemo(
    () => evaluatePoseReadiness(currentStage, camera.liveLandmarks, camera.frameSize),
    [camera.frameSize, camera.liveLandmarks, currentStage],
  );
  const holdProgressRatio = Math.min(holdProgressMs / (currentStage.holdSeconds * 1000), 1);

  const captureCoverage = useMemo(() => {
    const capturedStageIds = new Set(camera.frames.map((frame) => frame.stageId));
    const frontCount = camera.frames.filter((frame) => frame.view === 'front').length;
    const sideCount = camera.frames.filter((frame) => frame.view === 'side').length;
    const requiredMissing = REQUIRED_STAGE_IDS.filter((stageId) => !capturedStageIds.has(stageId));

    return {
      frontCount,
      sideCount,
      requiredMissing,
      ready:
        camera.frames.length >= MIN_CAPTURED_FRAMES &&
        frontCount >= 2 &&
        sideCount >= 2 &&
        requiredMissing.length === 0,
    };
  }, [camera.frames]);

  useEffect(() => {
    if (state.step !== 'capture' || capturePaused) {
      clearCaptureTimer();
      setHoldProgressMs(0);
      return;
    }

    if (!stageReadiness.ready) {
      clearCaptureTimer();
      setHoldProgressMs(0);
      return;
    }

    clearCaptureTimer();
    timerRef.current = window.setInterval(() => {
      setHoldProgressMs((previousMs) => {
        const nextMs = previousMs + 250;
        if (nextMs >= currentStage.holdSeconds * 1000) {
          const captured = camera.captureFrame(currentStage.view, currentStage.id);
          if (captured) {
            setCaptureIndex((previousIndex) => Math.min(previousIndex + 1, CAPTURE_PROTOCOL.length - 1));
          }
          return 0;
        }
        return nextMs;
      });
    }, 250);

    return () => {
      clearCaptureTimer();
    };
  }, [camera.captureFrame, capturePaused, currentStage.holdSeconds, currentStage.id, currentStage.view, stageReadiness.ready, state.step]);

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
    setHoldProgressMs(0);
    if (captureIndex < CAPTURE_PROTOCOL.length - 1) {
      setCaptureIndex((previousIndex) => previousIndex + 1);
    }
  };

  const restartCaptureFlow = () => {
    clearCaptureTimer();
    setCaptureIndex(0);
    setHoldProgressMs(0);
    setCapturePaused(false);
    camera.setFrames([]);
  };

  const handleManualCapture = () => {
    const captured = camera.captureFrame(currentStage.view, currentStage.id);
    if (captured) {
      setHoldProgressMs(0);
      if (captureIndex < CAPTURE_PROTOCOL.length - 1) {
        setCaptureIndex((previousIndex) => previousIndex + 1);
      }
    }
  };

  const handleUseCapture = () => {
    const estimates = estimateMeasurementsFromFrames(camera.frames, state.calibration, state.riderProfile.heightCm);
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

  const handleEmailShare = () => {
    setShareStatus('');
    window.location.href = buildMailtoUrl(state);
  };

  const handleWhatsAppShare = () => {
    setShareStatus('');
    window.open(buildWhatsAppUrl(state), '_blank', 'noopener,noreferrer');
  };

  const handleWebShare = async () => {
    try {
      setShareStatus('');
      const shared = await shareViaWebShare(state);
      if (!shared) {
        setShareStatus('Native sharing is not supported in this browser.');
      }
    } catch {
      setShareStatus('Sharing was canceled or could not be completed.');
    }
  };

  const cameraPreview = (
    <div className="camera-shell">
      <video ref={camera.videoRef} className="camera-video" playsInline muted autoPlay />
      <canvas ref={camera.canvasRef} className="camera-canvas" />
      <CaptureGuideOverlay stage={currentStage} />
    </div>
  );

  const renderCaptureSequence = () => (
    <div className="stage-sequence">
      {CAPTURE_PROTOCOL.map((stage, index) => {
        const statusClass = index < captureIndex ? 'done' : index === captureIndex ? 'current' : 'upcoming';
        return (
          <div key={stage.id} className={`stage-sequence-item ${statusClass}`}>
            <strong>{index + 1}. {stage.title}</strong>
            <div className="helper">{stage.view} view{stage.optional ? ' · optional' : ''}</div>
          </div>
        );
      })}
    </div>
  );

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
        <label className="field">
          <span>Age range (optional)</span>
          <select
            value={state.riderProfile.ageRange ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('ageRange', e.target.value ? (e.target.value as AppState['riderProfile']['ageRange']) : undefined)}
          >
            <option value="">Not provided</option>
            {AGE_RANGE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Biological sex (optional)</span>
          <select
            value={state.riderProfile.biologicalSex ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('biologicalSex', e.target.value ? (e.target.value as AppState['riderProfile']['biologicalSex']) : undefined)}
          >
            <option value="">Not provided</option>
            {BIOLOGICAL_SEX_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Current bike type (optional)</span>
          <select
            value={state.riderProfile.currentBikeType ?? ''}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('currentBikeType', e.target.value ? (e.target.value as AppState['riderProfile']['currentBikeType']) : undefined)}
          >
            <option value="">Not provided</option>
            {CURRENT_BIKE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid four">
        <Field label="Height (cm)" type="number" value={state.riderProfile.heightCm} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('heightCm', Number(e.target.value))} />
        <Field label="Weight (kg)" type="number" value={state.riderProfile.weightKg} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('weightKg', Number(e.target.value))} />
        <Field label="Shoe size" type="number" value={state.riderProfile.shoeSize} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('shoeSize', Number(e.target.value))} />
        <Field label="Current frame size (optional)" value={state.riderProfile.frameSize ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRiderProfile('frameSize', e.target.value)} />
      </div>
      <div className="grid four">
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
          <span>Fit priority</span>
          <select value={state.riderProfile.ridingGoal} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('ridingGoal', e.target.value as RidingGoal)}>
            <option value="comfort">Comfort</option>
            <option value="endurance">Endurance</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive / performance">Aggressive / performance</option>
          </select>
        </label>
        <label className="field">
          <span>Type of ride</span>
          <select value={state.riderProfile.rideType} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('rideType', e.target.value as AppState['riderProfile']['rideType'])}>
            {RIDE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid two">
        <label className="field">
          <span>Main terrain</span>
          <select value={state.riderProfile.preferredTerrain} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRiderProfile('preferredTerrain', e.target.value as AppState['riderProfile']['preferredTerrain'])}>
            {TERRAIN_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="card">
          <h3>Why dropdowns?</h3>
          <p className="helper">Structured dropdown choices make the fit engine use more precise and repeatable inputs than open free-text guesses.</p>
        </div>
      </div>
    </WizardLayout>
  );

  const renderCamera = () => (
    <WizardLayout title="Camera setup" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={nextStep}>
      <div className="grid two">
        <div className="card">
          <h3>How to stand for capture</h3>
          <ul>
            <li>Wear fitted clothing.</li>
            <li>Show your full body from head to feet.</li>
            <li>Place the camera around hip-to-chest height.</li>
            <li>Keep the room bright and avoid backlighting.</li>
            <li>The app will show tracked body parts and auto-capture when you are in the correct position.</li>
          </ul>
          <div className="status-row">
            <span className={`status-pill status-${qualityText.toLowerCase()}`}>Capture quality: {qualityText}</span>
            <span className="status-pill">Landmark confidence: {Math.round(camera.lastConfidence * 100)}%</span>
          </div>
          <h3>Required positions</h3>
          {renderCaptureSequence()}
          {camera.isInitializing && <p>Initializing camera and pose detector…</p>}
          {camera.error && <p>{camera.error}</p>}
        </div>
        {cameraPreview}
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
      subtitle="Move into the requested position. The app captures automatically once all checklist items are green."
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onBack={prevStep}
      onNext={handleUseCapture}
      nextLabel="Use capture"
      disableNext={!captureCoverage.ready}
    >
      <div className="grid two">
        <div className="card">
          <h3>{currentStage.title}</h3>
          <p>{currentStage.instruction}</p>
          <p>View: <strong>{currentStage.view}</strong></p>
          <p>Stage {captureIndex + 1} of {CAPTURE_PROTOCOL.length}</p>
          <div className="status-row">
            <span className={`status-pill status-${qualityText.toLowerCase()}`}>Capture quality: {qualityText}</span>
            <span className={`status-pill ${stageReadiness.ready ? 'status-good' : 'status-low'}`}>
              {stageReadiness.ready ? 'Good position detected' : 'Waiting for better position'}
            </span>
            {currentStage.optional && <span className="status-pill">Optional stage</span>}
          </div>
          <h4>Stand like this</h4>
          <ul>
            {currentStage.positionTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <h4>Live instructions</h4>
          <div className="instruction-list">
            {(stageReadiness.guidance.length ? stageReadiness.guidance : ['Good position detected. Hold still for automatic capture.']).map((instruction) => (
              <div key={instruction} className="instruction-item">{instruction}</div>
            ))}
          </div>
          <p className="helper">{stageReadiness.hint}</p>
          <div className="checklist">
            {stageReadiness.checks.map((check) => (
              <div key={check.label} className={`checklist-item ${check.passed ? 'good' : 'bad'}`}>
                <span>{check.passed ? '✓' : '•'}</span>
                <span>{check.label}</span>
              </div>
            ))}
          </div>
          <p>Captured frames: <strong>{camera.frames.length}</strong> · Front: <strong>{captureCoverage.frontCount}</strong> · Side: <strong>{captureCoverage.sideCount}</strong></p>
          <p>Auto-capture hold: <strong>{Math.round(holdProgressRatio * 100)}%</strong></p>
          <div className="progress-bar hold-progress"><span style={{ width: `${holdProgressRatio * 100}%` }} /></div>
          {!captureCoverage.ready && (
            <p className="helper">
              Before continuing, capture the essential positions. Missing: {captureCoverage.requiredMissing.length ? captureCoverage.requiredMissing.join(', ') : 'none'}.
            </p>
          )}
          <div className="button-row">
            <button className="secondary" onClick={handleManualCapture}>Capture now</button>
            <button className="secondary" onClick={() => setCapturePaused((previous) => !previous)}>{capturePaused ? 'Resume auto capture' : 'Pause auto capture'}</button>
            {currentStage.optional && <button className="secondary" onClick={skipCurrentStage}>Skip optional stage</button>}
            <button className="secondary" onClick={restartCaptureFlow}>Retry all capture steps</button>
          </div>
          <h4>All positions in this sequence</h4>
          {renderCaptureSequence()}
        </div>
        {cameraPreview}
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
        <p className="helper">If a value is missing or obviously wrong, the camera likely could not see that body part well enough. Enter the known manual value and continue.</p>
        <pre>{JSON.stringify(state.cameraEstimates, null, 2)}</pre>
      </div>
    </WizardLayout>
  );

  const renderBike = () => (
    <WizardLayout title="Bike category" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={nextStep}>
      <div className="grid two">
        <label className="field">
          <span>New bike category</span>
          <select value={state.bikeSelection.category} onChange={(e: ChangeEvent<HTMLSelectElement>) => updateBikeSelection('category', e.target.value as BikeCategory)}>
            {BIKE_CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="card">
          <h3>Chosen ride context</h3>
          <p><strong>Ride type:</strong> {state.riderProfile.rideType}</p>
          <p><strong>Main terrain:</strong> {state.riderProfile.preferredTerrain}</p>
          <p className="helper">Grouping bike options into road, gravel, MTB, urban, and BMX helps users choose precise categories without guessing the exact label first.</p>
        </div>
      </div>
      <div className="grid one">
        <Field label="Extra riding style notes (optional)" value={state.bikeSelection.ridingStyleNotes ?? ''} onChange={(e: ChangeEvent<HTMLInputElement>) => updateBikeSelection('ridingStyleNotes', e.target.value)} />
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
      <WizardLayout title="Results dashboard" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={() => exportFitPdf(state)} nextLabel="Download PDF">
        <div className="grid two">
          <div className="card">
            <h3>Rider summary</h3>
            <p><strong>Rider:</strong> {state.riderProfile.riderId || 'N/A'}</p>
            <p><strong>Height:</strong> {state.riderProfile.heightCm} cm</p>
            <p><strong>Fit priority:</strong> {state.riderProfile.ridingGoal}</p>
            <p><strong>Ride type:</strong> {state.riderProfile.rideType}</p>
            <p><strong>Main terrain:</strong> {state.riderProfile.preferredTerrain}</p>
            <p><strong>Bike category:</strong> {state.bikeSelection.category}</p>
            <p><strong>Posture bias:</strong> {fit.postureBias}</p>
          </div>
          <div className="card warn">
            <h3>Professional fitter disclaimer</h3>
            <p>Validate final bike choice and contact points with a professional fitter, especially if you have pain, injuries, asymmetries, or recurring discomfort.</p>
          </div>
        </div>
        <div className="card">
          <h3>Share your ideal bike measurements</h3>
          <p className="helper">You can download a PDF, open an email draft, send the summary to WhatsApp, or use native device sharing when the browser supports it.</p>
          <div className="button-row">
            <button onClick={() => exportFitPdf(state)}>Download PDF</button>
            <button className="secondary" onClick={handleEmailShare}>Email</button>
            <button className="secondary" onClick={handleWhatsAppShare}>WhatsApp</button>
            {webShareSupported && <button className="secondary" onClick={handleWebShare}>Share</button>}
          </div>
          {shareStatus && <p className="helper">{shareStatus}</p>}
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
