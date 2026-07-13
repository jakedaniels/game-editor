import { useMemo } from 'react';
import { deriveCombatModel, sampleTimeline, COMBAT_MODES, type SimValues } from '../../lib/systemSimMath';
import { useSimClock } from './useSimClock';
import SimFrame from './SimFrame';
import { Giant, Knight } from './simActors';
import { healthBeats, HpReadout } from './HealthSim';

const GROUND = 132;
const KNIGHT_X = 105;
const GIANT_X = 235;

/** The cross-system skirmish: the knight's HP reuses the health system's derived model. */
export default function CombatSim({ values, healthValues }: { values: SimValues; healthValues: SimValues | undefined }) {
  const model = useMemo(() => deriveCombatModel(values, healthValues), [values, healthValues]);
  const { t, rootRef } = useSimClock(model.periodSeconds);
  const time = t * model.periodSeconds;

  const hp = sampleTimeline(model.health.frames, time);
  const { swing, flinch, dead } = healthBeats(model.health, time);

  // the knight answers between enemy bops, alternating through the selected modes
  const modeIdx = Math.floor(time / 1.1) % Math.max(1, model.modes.length);
  const attackPhase = (time % 1.1) / 1.1; // knight strikes mid-beat
  const striking = !dead && model.modes.length > 0 && attackPhase > 0.45 && attackPhase < 0.75;
  const mode = model.modes[modeIdx];
  const strikeProgress = (attackPhase - 0.45) / 0.3;

  return (
    <SimFrame rootRef={rootRef} takeaway={model.takeaway}>
      <svg viewBox="0 0 320 150" role="img" aria-label="A skirmish between the player and an enemy">
        <line x1={12} y1={GROUND} x2={308} y2={GROUND} className="sim-ground" />
        <g transform={`translate(${2 * KNIGHT_X} 0) scale(-1 1)`}>
          <Knight
            x={KNIGHT_X + (striking && mode === 'melee' ? -strikeProgress * 24 : 0)}
            y={GROUND}
            scale={1.25}
            pose={dead ? 'dead' : flinch ? 'flinch' : 'idle'}
          />
        </g>
        <Giant x={GIANT_X} y={GROUND} scale={1.3} swing={swing} facing={1} />

        {striking && mode === 'ranged' && (
          <circle cx={KNIGHT_X + 18 + strikeProgress * (GIANT_X - KNIGHT_X - 40)} cy={GROUND - 34} r={3} className="sim-projectile" />
        )}
        {striking && mode === 'magic' && (
          <path
            d={`M ${KNIGHT_X + 14} ${GROUND - 36} Q ${(KNIGHT_X + GIANT_X) / 2} ${GROUND - 90} ${KNIGHT_X + 14 + strikeProgress * (GIANT_X - KNIGHT_X - 30)} ${GROUND - 40}`}
            className="sim-arc"
          />
        )}

        <HpReadout model={model.health} hp={hp} x={KNIGHT_X} />
        {model.modes.length > 0 && (
          <text x={308} y={16} textAnchor="end" className="sim-label">
            {model.modes.map((m) => COMBAT_MODES[m].label).join(' · ')}
          </text>
        )}
        {model.modes.length === 0 && (
          <text x={160} y={40} textAnchor="middle" className="sim__caption">
            Select a combat mode above
          </text>
        )}
        {model.healthFallback && (
          <text x={12} y={16} className="sim__caption">
            health system disabled — using defaults
          </text>
        )}
      </svg>
    </SimFrame>
  );
}
