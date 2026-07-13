import type { ReactNode } from 'react';
import type { QuestionDef } from '../../lib/gameSystems';
import './SystemSims.css';

export type SimSlider = {
  question: Extract<QuestionDef, { kind: 'slider' }>;
  /** Overrides the question's label inside the vignette (e.g. "Hammer strength"). */
  label?: string;
  value: number;
  onChange: (v: number) => void;
};

/**
 * Shared chrome for every system vignette: panel, kicker, the SVG scene, optional
 * embedded sliders (two-way bound to the same answers as the question form), takeaway line.
 */
export default function SimFrame({
  rootRef,
  sliders = [],
  takeaway,
  children,
}: {
  rootRef?: (el: HTMLElement | null) => void;
  sliders?: SimSlider[];
  takeaway: string;
  children: ReactNode;
}) {
  return (
    <div className="sim" ref={rootRef}>
      <div className="sim__kicker">Simulation</div>
      <div className="sim__stage">{children}</div>
      {sliders.map((s) => (
        <div key={s.question.key} className="sim__slider">
          <div className="sim__slider-head">
            <span className="sim__slider-label">{s.label ?? s.question.label}</span>
            <span className="sim__slider-value">
              {s.value} {s.question.unit}
            </span>
          </div>
          <input
            type="range"
            className="q__slider"
            min={s.question.min}
            max={s.question.max}
            step={s.question.step}
            value={s.value}
            onChange={(e) => s.onChange(Number(e.target.value))}
          />
        </div>
      ))}
      <p className="sim__takeaway">{takeaway}</p>
    </div>
  );
}
