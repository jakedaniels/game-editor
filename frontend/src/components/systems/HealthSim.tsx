import { useMemo } from 'react';
import { deriveHealthModel, sampleTimeline, DEATH_HOLD_S, POOL, type SimValues, type HealthModel } from '../../lib/systemSimMath';
import type { QuestionDef } from '../../lib/gameSystems';
import { useSimClock } from './useSimClock';
import SimFrame from './SimFrame';
import { Giant, Knight } from './simActors';

const GROUND = 132;
const KNIGHT_X = 190;
const GIANT_X = 82;

/** Hammer swing (0=raised, 1=down) + flinch/death flags at a moment in the loop. */
export function healthBeats(model: HealthModel, time: number) {
  const bops = model.frames.filter((f) => f.event === 'bop');
  const deathTime = bops.find((f) => f.value <= 0)?.time ?? Infinity;
  let swing = 0;
  for (const b of bops) {
    if (time < b.time && b.time - time < 0.45) swing = Math.max(swing, 1 - (b.time - time) / 0.45);
    if (time >= b.time && time - b.time < 0.3) swing = Math.max(swing, 1 - (time - b.time) / 0.3);
  }
  const flinch = bops.some((b) => time >= b.time && time - b.time < 0.25 && b.value > 0);
  const dead = time >= deathTime && time < deathTime + DEATH_HOLD_S + 0.5;
  const pickup = model.frames.find((f) => f.event === 'pickup' && time >= f.time - 0.45 && time < f.time);
  const pickupDrop = pickup ? 1 - (pickup.time - time) / 0.45 : null;
  return { swing, flinch, dead, pickupDrop };
}

export function HeartRow({ x, y, hp }: { x: number; y: number; hp: number }) {
  const filled = (hp / POOL) * 5;
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          transform={`translate(${i * 13} 0) scale(0.55)`}
          d="M 0 3 C -6 -4 -14 2 0 12 C 14 2 6 -4 0 3 Z"
          className={i < Math.round(filled) ? 'sim-heart' : 'sim-heart sim-heart--empty'}
        />
      ))}
    </g>
  );
}

export function HpReadout({ model, hp, x }: { model: HealthModel; hp: number; x: number }) {
  if (model.display === 'hidden') {
    return (
      <text x={x} y={26} textAnchor="middle" className="sim__caption">
        HP hidden from the player
      </text>
    );
  }
  if (model.display === 'numeric') {
    return (
      <text x={x} y={28} textAnchor="middle" className="sim-num">
        {Math.round(hp)}/{POOL}
      </text>
    );
  }
  if (model.display === 'hearts') return <HeartRow x={x - 32} y={18} hp={hp} />;
  return (
    <g>
      <rect x={x - 32} y={18} width={64} height={8} rx={4} className="sim-track" />
      <rect x={x - 32} y={18} width={Math.max(0, (hp / POOL) * 64)} height={8} rx={4} className={hp > 30 ? 'sim-fill-good' : 'sim-fill-bad'} />
    </g>
  );
}

export default function HealthSim({ values, setValue }: { values: SimValues; setValue: (key: string, v: number) => void }) {
  const model = useMemo(() => deriveHealthModel(values), [values]);
  const { t, rootRef } = useSimClock(model.periodSeconds);
  const time = t * model.periodSeconds;

  const hp = sampleTimeline(model.frames, time);
  const { swing, flinch, dead, pickupDrop } = healthBeats(model, time);

  const lethalityQ: Extract<QuestionDef, { kind: 'slider' }> = {
    kind: 'slider',
    key: 'lethality',
    label: 'Lethality threshold',
    min: 0,
    max: 100,
    step: 5,
    unit: '% HP',
    defaultValue: 65,
  };

  return (
    <SimFrame
      rootRef={rootRef}
      takeaway={model.takeaway}
      sliders={[{ question: lethalityQ, label: 'Hammer strength', value: Number(values.lethality ?? 65), onChange: (v) => setValue('lethality', v) }]}
    >
      <svg viewBox="0 0 320 150" role="img" aria-label="A giant bops a knight to show how many hits the player survives">
        <line x1={12} y1={GROUND} x2={308} y2={GROUND} className="sim-ground" />
        <Giant x={GIANT_X} y={GROUND} scale={1.35} swing={swing} facing={-1} />
        <Knight x={KNIGHT_X} y={GROUND} scale={1.25} pose={dead ? 'dead' : flinch ? 'flinch' : 'idle'} />
        {pickupDrop !== null && (
          <path
            transform={`translate(${KNIGHT_X + 26} ${46 + pickupDrop * 66}) scale(0.6)`}
            d="M 0 3 C -6 -4 -14 2 0 12 C 14 2 6 -4 0 3 Z"
            className="sim-heart"
          />
        )}
        <HpReadout model={model} hp={hp} x={KNIGHT_X} />
        {model.regen === 'rest' && !dead && (
          <text x={308} y={GROUND - 6} textAnchor="end" className="sim__caption">
            🔥 rest heals
          </text>
        )}
      </svg>
    </SimFrame>
  );
}
