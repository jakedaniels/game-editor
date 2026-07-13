import { useMemo, useRef, useState } from 'react';
import { deriveMovementModel, type SimValues } from '../../lib/systemSimMath';
import type { QuestionDef } from '../../lib/gameSystems';
import { useSimStepper } from './useSimClock';
import SimFrame from './SimFrame';
import { Knight } from './simActors';

const GROUND = 132;
const UNIT_PX = 10; // 1 game unit = 10px in the vignette
const RUN_MIN_X = 40;
const RUN_MAX_X = 280;

const sliderQ = (key: string, label: string, min: number, max: number, step: number, unit: string, defaultValue: number): Extract<QuestionDef, { kind: 'slider' }> => ({
  kind: 'slider',
  key,
  label,
  min,
  max,
  step,
  unit,
  defaultValue,
});

/** The interactive one: click/Tab to focus, spacebar (or click) to jump. */
export default function MovementSim({ values, setValue }: { values: SimValues; setValue: (key: string, v: number) => void }) {
  const model = useMemo(() => deriveMovementModel(values), [values]);
  const modelRef = useRef(model);
  modelRef.current = model;

  // Physics state lives in refs; one state snapshot per frame for rendering.
  const phys = useRef({ x: RUN_MIN_X, dir: 1, height: 0, vy: 0, jumping: false });
  const [frame, setFrame] = useState(phys.current);
  const [jumped, setJumped] = useState(false); // hide the hint after first jump

  const { rootRef } = useSimStepper((dt) => {
    const p = phys.current;
    const m = modelRef.current;
    // idle auto-run back and forth at runSpeed
    p.x += p.dir * m.runSpeed * UNIT_PX * dt;
    if (p.x > RUN_MAX_X) (p.x = RUN_MAX_X), (p.dir = -1);
    if (p.x < RUN_MIN_X) (p.x = RUN_MIN_X), (p.dir = 1);
    // ballistic jump
    if (p.jumping) {
      p.vy -= m.gravityUnits * dt;
      p.height += p.vy * dt;
      if (p.height <= 0) {
        p.height = 0;
        p.vy = 0;
        p.jumping = false;
      }
    }
    setFrame({ ...p });
  });

  const jump = () => {
    if (!phys.current.jumping) {
      phys.current.jumping = true;
      phys.current.vy = modelRef.current.jumpVelocity;
      setJumped(true);
    }
  };

  const apexPx = model.jumpHeight * UNIT_PX;
  // dotted trajectory arc: parabola over the horizontal distance covered during hang time
  const arcHalf = (model.runSpeed * UNIT_PX * model.hangTime) / 2;
  const arc = `M ${frame.x - arcHalf * frame.dir} ${GROUND} Q ${frame.x} ${GROUND - 2 * apexPx} ${frame.x + arcHalf * frame.dir} ${GROUND}`;

  return (
    <SimFrame
      rootRef={rootRef}
      takeaway={model.takeaway}
      sliders={[
        { question: sliderQ('jumpHeight', 'Jump height', 1, 10, 1, 'units', 3), value: Number(values.jumpHeight ?? 3), onChange: (v) => setValue('jumpHeight', v) },
        { question: sliderQ('gravity', 'Gravity', 10, 200, 5, '% of Earth', 100), value: Number(values.gravity ?? 100), onChange: (v) => setValue('gravity', v) },
      ]}
    >
      <div
        className="sim__interactive"
        tabIndex={0}
        role="button"
        aria-label="Jump simulation — press space or click to make the knight jump"
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            jump();
          }
        }}
        onClick={jump}
      >
        <svg viewBox="0 0 320 150">
          <line x1={12} y1={GROUND} x2={308} y2={GROUND} className="sim-ground" />
          {/* max-height ghost line */}
          <line x1={12} y1={GROUND - apexPx} x2={308} y2={GROUND - apexPx} className="sim-ghost" strokeDasharray="2 6" />
          <text x={14} y={GROUND - apexPx - 4} className="sim-label">
            {model.jumpHeight}u apex
          </text>
          <path d={arc} className="sim-arc" />
          <g transform={frame.dir === -1 ? `translate(${2 * frame.x} 0) scale(-1 1)` : undefined}>
            <Knight x={frame.x} y={GROUND - frame.height * UNIT_PX} scale={1.25} pose="idle" />
          </g>
          {!jumped && (
            <text x={160} y={24} textAnchor="middle" className="sim__hint">
              click, then press space to jump
            </text>
          )}
        </svg>
      </div>
    </SimFrame>
  );
}
