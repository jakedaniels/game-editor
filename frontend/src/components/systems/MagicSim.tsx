import { useMemo } from 'react';
import { deriveMagicModel, sampleTimeline, POOL, type SimValues } from '../../lib/systemSimMath';
import { useSimClock } from './useSimClock';
import SimFrame from './SimFrame';
import { Caster } from './simActors';

const GROUND = 118;

/** Per-school tint: a mix of the two theme accents, so every theme stays consistent. */
const schoolColor = (index: number, total: number) => {
  const pct = total <= 1 ? 50 : Math.round((index / (total - 1)) * 100);
  return `color-mix(in srgb, var(--orange) ${100 - pct}%, var(--green))`;
};

export default function MagicSim({ values }: { values: SimValues }) {
  const model = useMemo(() => deriveMagicModel(values), [values]);
  const { t, rootRef } = useSimClock(model.periodSeconds);
  const time = t * model.periodSeconds;

  if (model.schools.length === 0) {
    return (
      <SimFrame rootRef={rootRef} takeaway={model.takeaway}>
        <svg viewBox="0 0 320 150">
          <line x1={12} y1={GROUND} x2={308} y2={GROUND} className="sim-ground" />
          <Caster x={70} y={GROUND} scale={1.3} />
          <text x={180} y={70} textAnchor="middle" className="sim__caption">
            Pick at least one school to see casting
          </text>
        </svg>
      </SimFrame>
    );
  }

  const casts = model.frames.filter((f) => f.event && f.event in Object.fromEntries(model.schools.map((s) => [s.id, 1])));
  // a spell blob in flight for 0.6s after each cast
  const inFlight = casts
    .map((c) => ({ school: c.event!, progress: (time - c.time) / 0.6 }))
    .filter((c) => c.progress >= 0 && c.progress <= 1);
  const casting = inFlight.some((c) => c.progress < 0.4);
  const dry = model.resource === 'mana' && model.frames.some((f) => f.event === 'dry' && time >= f.time && time < f.time + 0.6);

  return (
    <SimFrame rootRef={rootRef} takeaway={model.takeaway}>
      <svg viewBox="0 0 320 150" role="img" aria-label="A caster demonstrating the magic resource model">
        <line x1={12} y1={GROUND} x2={308} y2={GROUND} className="sim-ground" />
        <Caster x={62} y={GROUND} scale={1.3} casting={casting} />
        {inFlight.map((c, i) => {
          const idx = model.schools.findIndex((s) => s.id === c.school);
          return (
            <circle
              key={i}
              cx={90 + c.progress * 190}
              cy={GROUND - 48 - Math.sin(c.progress * Math.PI) * 22}
              r={4.5}
              style={{ fill: schoolColor(idx, model.schools.length) }}
            />
          );
        })}
        {dry && (
          <text x={95} y={GROUND - 55} className="sim-flash">
            fzzt…
          </text>
        )}

        {model.resource === 'mana' && (
          <g>
            <rect x={40} y={134} width={240} height={9} rx={4.5} className="sim-track" />
            <rect x={40} y={134} width={Math.max(0, (sampleTimeline(model.frames, time) / POOL) * 240)} height={9} rx={4.5} className="sim-fill-good" />
            <text x={34} y={142} textAnchor="end" className="sim-label">
              MP
            </text>
          </g>
        )}

        {model.resource === 'cooldown' && (
          <g>
            {model.schools.map((s, i) => {
              const progress = ((time % s.cooldown) / s.cooldown + 1) % 1;
              const ready = progress > 0.92;
              const cx = 160 + (i - (model.schools.length - 1) / 2) * 46;
              const r = 13;
              const sweep = progress * 2 * Math.PI - Math.PI / 2;
              const large = progress > 0.5 ? 1 : 0;
              return (
                <g key={s.id}>
                  <circle cx={cx} cy={122} r={r} className="sim-dial-track" />
                  <path
                    d={`M ${cx} ${122 - r} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(sweep)} ${122 + r * Math.sin(sweep)}`}
                    className={'sim-dial-sweep' + (ready ? ' sim-dial-ready' : '')}
                    style={{ stroke: ready ? undefined : schoolColor(i, model.schools.length) }}
                  />
                  <text x={cx} y={144} textAnchor="middle" className="sim-label">
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {model.resource === 'charges' && (
          <g>
            {model.schools.map((s, i) => {
              const remaining = sampleTimeline(model.frames, time, true);
              const spentTotal = model.totalCharges - Math.round(remaining);
              return (
                <g key={s.id} transform={`translate(${120 + i * 60} 130)`}>
                  {[0, 1, 2].map((p) => {
                    // charges are consumed round-robin across schools
                    const spentForSchool = Math.floor(spentTotal / model.schools.length) + (spentTotal % model.schools.length > i ? 1 : 0);
                    const spent = p < spentForSchool;
                    return <circle key={p} cx={p * 14} cy={0} r={5} className={spent ? 'sim-pip sim-pip--spent' : 'sim-pip'} style={spent ? undefined : { fill: schoolColor(i, model.schools.length) }} />;
                  })}
                  <text x={14} y={16} textAnchor="middle" className="sim-label">
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </SimFrame>
  );
}
