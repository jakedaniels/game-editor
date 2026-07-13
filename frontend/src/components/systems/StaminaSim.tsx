import { useMemo } from 'react';
import { deriveStaminaModel, sampleTimeline, DRAIN_COSTS, POOL, type SimValues } from '../../lib/systemSimMath';
import type { QuestionDef } from '../../lib/gameSystems';
import { useSimClock } from './useSimClock';
import SimFrame from './SimFrame';
import { Knight } from './simActors';

const GROUND = 118;

const ACTION_ICONS: Record<string, string> = { sprint: '💨', jump: '⤴', attack: '⚔', block: '🛡', rest: '…' };

export default function StaminaSim({ values, setValue }: { values: SimValues; setValue: (key: string, v: number) => void }) {
  const model = useMemo(() => deriveStaminaModel(values), [values]);
  const { t, rootRef } = useSimClock(model.periodSeconds);
  const time = t * model.periodSeconds;

  const stamina = model.drains.length ? sampleTimeline(model.frames, time) : POOL;
  // which scripted action is happening right now
  const current = model.frames.find((f) => f.event && time <= f.time && time > f.time - (DRAIN_COSTS[f.event]?.duration ?? 2));
  const resting = current?.event === 'rest' || (!current && model.drains.length > 0 && stamina < POOL);
  const action = current?.event && current.event !== 'rest' ? current.event : null;

  // knight bobs while exerting, pants while resting
  const bob = action ? Math.sin(time * 18) * 2.5 : 0;
  const knightX = action === 'sprint' ? 120 + Math.sin(time * 6) * 40 : 120;

  const regenQ: Extract<QuestionDef, { kind: 'slider' }> = { kind: 'slider', key: 'regenRate', label: 'Regen rate', min: 1, max: 50, step: 1, unit: '/sec', defaultValue: 12 };

  return (
    <SimFrame
      rootRef={rootRef}
      takeaway={model.takeaway}
      sliders={[{ question: regenQ, value: Number(values.regenRate ?? 12), onChange: (v) => setValue('regenRate', v) }]}
    >
      <svg viewBox="0 0 320 150" role="img" aria-label="A knight exerting himself and recovering stamina">
        <line x1={12} y1={GROUND} x2={308} y2={GROUND} className="sim-ground" />
        <g transform={`translate(0 ${bob})`}>
          <Knight x={knightX} y={GROUND} scale={1.25} pose={resting ? 'pant' : 'idle'} />
        </g>
        {action && (
          <text x={knightX + 26} y={GROUND - 40} className="sim-num">
            {ACTION_ICONS[action]} {DRAIN_COSTS[action]?.label}
          </text>
        )}
        {resting && (
          <text x={knightX + 24} y={GROUND - 40} className="sim__caption">
            huff… puff…
          </text>
        )}
        {/* stamina bar */}
        <rect x={40} y={134} width={240} height={9} rx={4.5} className="sim-track" />
        <rect x={40} y={134} width={Math.max(0, (stamina / POOL) * 240)} height={9} rx={4.5} className={stamina > 25 ? 'sim-fill-good' : 'sim-fill-bad'} />
        <text x={34} y={142} textAnchor="end" className="sim-label">
          SP
        </text>
        {model.drains.length === 0 && (
          <text x={160} y={40} textAnchor="middle" className="sim__caption">
            Nothing drains stamina yet — select a drain above
          </text>
        )}
      </svg>
    </SimFrame>
  );
}
