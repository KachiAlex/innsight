import { Check } from 'lucide-react';
import styles from './Stepper.module.css';

export interface Step {
  key: string;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  /** Index of the active step (0-based) */
  current: number;
  /** Clickable completed steps — calls with step index */
  onStepClick?: (index: number) => void;
}

export default function Stepper({ steps, current, onStepClick }: StepperProps) {
  return (
    <ol className={styles.stepper} aria-label="Progress">
      {steps.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        const clickable = state === 'done' && !!onStepClick;
        return (
          <li key={step.key} className={`${styles.step} ${styles[state]}`}>
            <button
              type="button"
              className={styles.marker}
              onClick={clickable ? () => onStepClick(i) : undefined}
              disabled={!clickable}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className={styles.circle}>
                {state === 'done' ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className={styles.labels}>
                <span className={styles.label}>{step.label}</span>
                {step.description && <span className={styles.desc}>{step.description}</span>}
              </span>
            </button>
            {i < steps.length - 1 && <span className={styles.connector} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
