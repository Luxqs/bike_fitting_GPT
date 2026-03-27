import './captureGuide.css';
import { CaptureStage } from '../../config/captureProtocol';

interface Props {
  stage: CaptureStage;
}

const HIGHLIGHT_BY_STAGE: Record<CaptureStage['id'], string[]> = {
  'front-neutral': ['body'],
  'front-tpose': ['left-arm', 'right-arm'],
  'front-overhead': ['left-arm', 'right-arm'],
  'side-neutral': ['body'],
  'side-knee-lifts': ['left-leg', 'right-leg'],
  'side-squat': ['left-leg', 'right-leg', 'body'],
  'side-hinge': ['body'],
  'side-seated': ['body', 'left-leg', 'right-leg'],
  'side-pedal': ['left-leg', 'right-leg'],
};

export function CaptureGuideOverlay({ stage }: Props) {
  const highlighted = new Set(HIGHLIGHT_BY_STAGE[stage.id]);

  return (
    <svg className="capture-guide-overlay" viewBox="0 0 300 420" aria-hidden="true">
      <circle cx="150" cy="55" r="24" className="guide-outline" />
      <line x1="150" y1="79" x2="150" y2="195" className={`guide-outline ${highlighted.has('body') ? 'guide-highlight' : ''}`} />
      <line x1="150" y1="110" x2="92" y2={stage.id === 'front-overhead' ? '48' : stage.id === 'front-tpose' ? '110' : '160'} className={`guide-outline ${highlighted.has('left-arm') ? 'guide-highlight' : ''}`} />
      <line x1="150" y1="110" x2="208" y2={stage.id === 'front-overhead' ? '48' : stage.id === 'front-tpose' ? '110' : '160'} className={`guide-outline ${highlighted.has('right-arm') ? 'guide-highlight' : ''}`} />
      <line x1="150" y1="195" x2="112" y2={stage.id === 'side-squat' ? '302' : stage.id === 'side-seated' ? '270' : '322'} className={`guide-outline ${highlighted.has('left-leg') ? 'guide-highlight' : ''}`} />
      <line x1="150" y1="195" x2="188" y2={stage.id === 'side-knee-lifts' || stage.id === 'side-pedal' ? '250' : stage.id === 'side-squat' ? '302' : stage.id === 'side-seated' ? '270' : '322'} className={`guide-outline ${highlighted.has('right-leg') ? 'guide-highlight' : ''}`} />
      <line x1="112" y1={stage.id === 'side-squat' ? '302' : stage.id === 'side-seated' ? '270' : '322'} x2="104" y2="385" className={`guide-outline ${highlighted.has('left-leg') ? 'guide-highlight' : ''}`} />
      <line x1="188" y1={stage.id === 'side-knee-lifts' || stage.id === 'side-pedal' ? '250' : stage.id === 'side-squat' ? '302' : stage.id === 'side-seated' ? '270' : '322'} x2="196" y2="385" className={`guide-outline ${highlighted.has('right-leg') ? 'guide-highlight' : ''}`} />
      <text x="18" y="26" className="guide-label">Target silhouette</text>
    </svg>
  );
}
