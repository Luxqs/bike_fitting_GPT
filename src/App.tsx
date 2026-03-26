import { useEffect, useMemo, useState } from 'react';
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
import { PAIN_OPTIONS } from './types';
import './styles.css';

export default function App() {
  const { state, setState, nextStep, prevStep, stepIndex, totalSteps } = useAppState();
  const camera = usePoseCapture();
  const [captureIndex, setCaptureIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if ((state.step === 'camera' || state.step === 'capture') && !camera.isReady && !camera.error) {
      camera.init().then(() => camera.startOverlayLoop());
    }
  }, [state.step]);

  useEffect(() => {
    if (state.step !== 'capture') return;
    const stage = CAPTURE_PROTOCOL[captureIndex];
    setCountdown(stage.seconds);
    const timer = setInterval(() => {
      setCountdown((v) => {
        if (v <= 1) {
          camera.captureFrame(stage.view, stage.id);
          if (captureIndex < CAPTURE_PROTOCOL.length - 1) {
            setCaptureIndex((i) => i + 1);
          }
          clearInterval(timer);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state.step, captureIndex]);

  const qualityText = useMemo(() => camera.lastConfidence > 0.7 ? 'Good' : camera.lastConfidence > 0.5 ? 'Okay' : 'Low', [camera.lastConfidence]);
  const currentStage = CAPTURE_PROTOCOL[Math.min(captureIndex, CAPTURE_PROTOCOL.length - 1)];

  const renderWelcome = () => (
    <WizardLayout title="BikeFit Camera" subtitle="Estimate comfort and performance fit dimensions for a new bike using guided camera capture and manual measurements." stepIndex={stepIndex} totalSteps={totalSteps} onNext={nextStep} nextLabel="Start">
      <div className="grid two">
        <div className="card">
          <h3>Important disclaimer</h3>
          <p>This is a comfort/performance estimation tool, not a medical device.</p>
          <p>Final bike selection should be validated by a professional fitter, especially if you have pain, injuries, asymmetries, or persistent discomfort.</p>
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
        <Field label="Name or rider ID" value={state.riderProfile.riderId} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, riderId: e.target.value } }))} />
        <Field label="Height (cm)" type="number" value={state.riderProfile.heightCm} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, heightCm: Number(e.target.value) } }))} />
        <Field label="Weight (kg)" type="number" value={state.riderProfile.weightKg} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, weightKg: Number(e.target.value) } }))} />
        <Field label="Shoe size" type="number" value={state.riderProfile.shoeSize} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, shoeSize: Number(e.target.value) } }))} />
      </div>
      <div className="grid three">
        <label className="field"><span>Flexibility</span><select value={state.riderProfile.flexibilityLevel} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, flexibilityLevel: e.target.value as any } }))}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>
        <label className="field"><span>Experience</span><select value={state.riderProfile.experienceLevel} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, experienceLevel: e.target.value as any } }))}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        <label className="field"><span>Goal</span><select value={state.riderProfile.ridingGoal} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, ridingGoal: e.target.value as any } }))}><option value="comfort">Comfort</option><option value="endurance">Endurance</option><option value="balanced">Balanced</option><option value="aggressive / performance">Aggressive / performance</option></select></label>
      </div>
      <div className="grid three">
        <Field label="Preferred terrain" value={state.riderProfile.preferredTerrain} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, preferredTerrain: e.target.value } }))} />
        <Field label="Current bike type" value={state.riderProfile.currentBikeType ?? ''} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, currentBikeType: e.target.value } }))} />
        <Field label="Current frame size" value={state.riderProfile.frameSize ?? ''} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, frameSize: e.target.value } }))} />
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
          <p>Capture quality: <strong>{qualityText}</strong></p>
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
      <CalibrationPanel onComplete={(calibration) => { setState((s) => ({ ...s, calibration })); nextStep(); }} />
    </WizardLayout>
  );

  const renderCapture = () => (
    <WizardLayout title="Guided movement capture" subtitle="Low-confidence frames are rejected automatically." stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={() => {
      const estimates = estimateMeasurementsFromFrames(camera.frames, state.calibration);
      setState((s) => ({ ...s, capturedFrames: camera.frames, cameraEstimates: estimates }));
      nextStep();
    }} nextLabel="Use capture">
      <div className="grid two">
        <div className="card">
          <h3>{currentStage.title}</h3>
          <p>{currentStage.instruction}</p>
          <p>View: <strong>{currentStage.view}</strong></p>
          <p>Countdown: <strong>{countdown}s</strong></p>
          <p>Captured frames: <strong>{camera.frames.length}</strong></p>
          <button className="secondary" onClick={() => camera.captureFrame(currentStage.view, currentStage.id)}>Capture now</button>
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
        <Field label="Inseam (cm)" type="number" value={state.manualMeasurements.inseamCm ?? ''} onChange={(e) => setState((s) => ({ ...s, manualMeasurements: { ...s.manualMeasurements, inseamCm: Number(e.target.value) } }))} />
        <Field label="Arm span (cm)" type="number" value={state.manualMeasurements.armSpanCm ?? ''} onChange={(e) => setState((s) => ({ ...s, manualMeasurements: { ...s.manualMeasurements, armSpanCm: Number(e.target.value) } }))} />
        <Field label="Shoulder width (cm)" type="number" value={state.manualMeasurements.shoulderWidthCm ?? ''} onChange={(e) => setState((s) => ({ ...s, manualMeasurements: { ...s.manualMeasurements, shoulderWidthCm: Number(e.target.value) } }))} />
        <Field label="Torso length (cm)" type="number" value={state.manualMeasurements.torsoLengthCm ?? ''} onChange={(e) => setState((s) => ({ ...s, manualMeasurements: { ...s.manualMeasurements, torsoLengthCm: Number(e.target.value) } }))} />
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
        <label className="field wide"><span>Bike category</span><select value={state.bikeSelection.category} onChange={(e) => setState((s) => ({ ...s, bikeSelection: { ...s.bikeSelection, category: e.target.value as any } }))}>{Object.keys(BIKE_CATEGORY_CONFIG).map((category) => <option key={category}>{category}</option>)}</select></label>
        <Field label="Riding style notes" value={state.bikeSelection.ridingStyleNotes ?? ''} onChange={(e) => setState((s) => ({ ...s, bikeSelection: { ...s.bikeSelection, ridingStyleNotes: e.target.value } }))} />
      </div>
    </WizardLayout>
  );

  const renderIssues = () => (
    <WizardLayout title="Pain points and issues" stepIndex={stepIndex} totalSteps={totalSteps} onBack={prevStep} onNext={() => { setState((s) => ({ ...s, fitResult: calculateFit(s) })); nextStep(); }} nextLabel="Calculate fit">
      <div className="checkbox-grid">
        {PAIN_OPTIONS.map((option) => (
          <label key={option} className="checkbox-item">
            <input type="checkbox" checked={state.issues.selected.includes(option)} onChange={(e) => setState((s) => ({ ...s, issues: { ...s.issues, selected: e.target.checked ? [...s.issues.selected.filter((i) => i !== 'No issues, just sizing a new bike'), option] : s.issues.selected.filter((i) => i !== option) } }))} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <label className="field"><span>Free text notes</span><textarea value={state.issues.freeText ?? ''} onChange={(e) => setState((s) => ({ ...s, issues: { ...s.issues, freeText: e.target.value } }))} /></label>
      <label className="field"><span>Injury / limitation notes</span><textarea value={state.riderProfile.injuryNotes ?? ''} onChange={(e) => setState((s) => ({ ...s, riderProfile: { ...s.riderProfile, injuryNotes: e.target.value } }))} /></label>
    </WizardLayout>
  );

  const renderResults = () => {
    const fit = state.fitResult;
    if (!fit) return null;
    const items = [fit.frameSize, fit.effectiveTopTube, fit.stack, fit.reach, fit.saddleHeight, fit.saddleSetback, fit.saddleToBarDrop, fit.handlebarWidth, fit.stemLength, fit.crankLength, ...(fit.seatpostSuggestion ? [fit.seatpostSuggestion] : [])];
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
            {fit.derivedMeasurements.map((m) => <p key={m.key}>{m.label}: <strong>{m.value} {m.unit ?? ''}</strong> · {m.source} · {Math.round(m.confidence * 100)}%</p>)}
          </div>
          <div className="card">
            <h3>Warnings and assumptions</h3>
            {fit.warnings.map((w, i) => <p key={i}>• {w}</p>)}
            {fit.assumptions.map((a, i) => <p key={`a-${i}`}>• {a}</p>)}
            <p><strong>Between sizes:</strong> {fit.betweenSizesNote}</p>
          </div>
        </div>
      </WizardLayout>
    );
  };

  switch (state.step) {
    case 'welcome': return renderWelcome();
    case 'profile': return renderProfile();
    case 'camera': return renderCamera();
    case 'calibration': return renderCalibration();
    case 'capture': return renderCapture();
    case 'manual': return renderManual();
    case 'bike': return renderBike();
    case 'issues': return renderIssues();
    case 'results': return renderResults();
    default: return null;
  }
}
