import { useMemo } from 'react';
import { deriveInventoryModel, PICKUPS_PER_SECOND, type SimValues } from '../../lib/systemSimMath';
import type { QuestionDef } from '../../lib/gameSystems';
import { useSimClock } from './useSimClock';
import SimFrame from './SimFrame';
import { Knight } from './simActors';

const GROUND = 128;

export default function InventorySim({ values, setValue }: { values: SimValues; setValue: (key: string, v: number) => void }) {
  const model = useMemo(() => deriveInventoryModel(values), [values]);
  const { t, rootRef } = useSimClock(model.periodSeconds);
  const time = t * model.periodSeconds;

  const slotsQ: Extract<QuestionDef, { kind: 'slider' }> = { kind: 'slider', key: 'slots', label: 'Default slots', min: 4, max: 64, step: 1, unit: 'slots', defaultValue: 12 };
  const slider =
    model.capacityModel === 'unlimited'
      ? []
      : [{ question: slotsQ, label: model.capacityModel === 'weight' ? 'Weight budget' : 'Default slots', value: Number(values.slots ?? 12), onChange: (v: number) => setValue('slots', v) }];

  // shared: how many pickups have landed so far this loop
  const itemCount = model.capacityModel === 'weight' ? model.weights.length : model.slots;
  const picked = Math.min(itemCount, Math.floor(time * PICKUPS_PER_SECOND));
  const full = picked >= itemCount && model.capacityModel !== 'unlimited';
  const sag = picked / Math.max(1, itemCount); // knight slumps as the pack fills

  return (
    <SimFrame rootRef={rootRef} takeaway={model.takeaway} sliders={slider}>
      <svg viewBox="0 0 320 150" role="img" aria-label="An inventory filling up with loot">
        <line x1={12} y1={GROUND} x2={308} y2={GROUND} className="sim-ground" />
        <Knight x={44} y={GROUND} scale={1.2} pose={sag > 0.75 && model.capacityModel !== 'unlimited' ? 'sag' : 'idle'} />

        {model.capacityModel === 'slots' && (
          <SlotGrid slots={model.slots} filled={picked} full={full} />
        )}

        {model.capacityModel === 'weight' && (
          <g>
            <rect x={90} y={60} width={200} height={14} rx={5} className="sim-track" />
            <rect
              x={90}
              y={60}
              width={picked > 0 ? Math.min(200, (model.weights[picked - 1] / model.slots) * 200) : 0}
              height={14}
              rx={5}
              className={full ? 'sim-fill-bad' : 'sim-fill-good'}
            />
            <text x={90} y={52} className="sim-label">
              {picked > 0 ? `${picked} items · ${model.weights[picked - 1]}/${model.slots} weight` : `0/${model.slots} weight`}
            </text>
            {full && (
              <text x={190} y={100} textAnchor="middle" className="sim-flash">
                OVERLOADED
              </text>
            )}
          </g>
        )}

        {model.capacityModel === 'unlimited' && (
          <g>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const x = ((time * 40 + i * 55) % 260) + 60;
              return <rect key={i} x={x} y={92} width={12} height={12} rx={3} className="sim-slot--filled sim-slot" />;
            })}
            <text x={190} y={70} textAnchor="middle" className="sim-label">
              …and it all fits
            </text>
          </g>
        )}
      </svg>
    </SimFrame>
  );
}

function SlotGrid({ slots, filled, full }: { slots: number; filled: number; full: boolean }) {
  const cols = Math.ceil(Math.sqrt(slots * 2)); // wider than tall
  const rows = Math.ceil(slots / cols);
  const cell = Math.min(16, 110 / rows, 210 / cols);
  const originX = 95;
  const originY = 26;
  return (
    <g>
      {Array.from({ length: slots }, (_, i) => (
        <rect
          key={i}
          x={originX + (i % cols) * (cell + 2)}
          y={originY + Math.floor(i / cols) * (cell + 2)}
          width={cell}
          height={cell}
          rx={2.5}
          className={i < filled ? 'sim-slot sim-slot--filled' : 'sim-slot'}
        />
      ))}
      {full && (
        <text x={originX + (cols * (cell + 2)) / 2} y={originY + rows * (cell + 2) + 16} textAnchor="middle" className="sim-flash">
          FULL
        </text>
      )}
    </g>
  );
}
