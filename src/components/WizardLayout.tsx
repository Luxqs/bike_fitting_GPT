import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  stepIndex: number;
  totalSteps: number;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  disableNext?: boolean;
}

export function WizardLayout({ title, subtitle, stepIndex, totalSteps, children, onBack, onNext, nextLabel = 'Continue', disableNext }: Props) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;
  return (
    <div className="page-shell">
      <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
      <div className="page-header">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-body">{children}</div>
      <div className="page-actions">
        {onBack && <button className="secondary" onClick={onBack}>Back</button>}
        {onNext && <button onClick={onNext} disabled={disableNext}>{nextLabel}</button>}
      </div>
    </div>
  );
}
