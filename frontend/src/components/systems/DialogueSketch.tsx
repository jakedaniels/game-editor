import { useMemo } from 'react';
import { deriveDialogueModel, type SimValues } from '../../lib/systemSimMath';
import SimFrame from './SimFrame';

/** No numeric sim for dialogue — a light branching-shape sketch that morphs with the answer. */
export default function DialogueSketch({ values }: { values: SimValues }) {
  const model = useMemo(() => deriveDialogueModel(values), [values]);

  return (
    <SimFrame takeaway={model.takeaway}>
      <svg viewBox="0 0 320 150" role="img" aria-label={`Dialogue shape: ${model.branching}`}>
        {model.branching === 'linear' && (
          <g>
            <path d="M 60 75 H 260" className="sim-edge" />
            {[60, 127, 194, 260].map((x, i) => (
              <circle key={x} cx={x} cy={75} r={10} className={'sim-node' + (i === 1 ? ' sim-node--pulse' : '')} />
            ))}
          </g>
        )}
        {model.branching === 'choice' && (
          <g>
            <path d="M 90 75 L 210 30 M 90 75 L 210 75 M 90 75 L 210 120" className="sim-edge" />
            <circle cx={90} cy={75} r={12} className="sim-node" />
            {[30, 75, 120].map((y, i) => (
              <circle key={y} cx={210} cy={y} r={9} className={'sim-node' + (i === 1 ? ' sim-node--pulse' : '')} />
            ))}
          </g>
        )}
        {model.branching === 'tree' && (
          <g>
            <path
              d="M 60 75 L 140 40 M 60 75 L 140 110 M 140 40 L 220 22 M 140 40 L 220 60 M 140 110 L 220 60 M 140 110 L 220 122 M 220 60 L 285 60"
              className="sim-edge"
            />
            <circle cx={60} cy={75} r={11} className="sim-node" />
            <circle cx={140} cy={40} r={9} className="sim-node" />
            <circle cx={140} cy={110} r={9} className="sim-node" />
            <circle cx={220} cy={22} r={8} className="sim-node" />
            <circle cx={220} cy={60} r={8} className="sim-node sim-node--pulse" />
            <circle cx={220} cy={122} r={8} className="sim-node" />
            <circle cx={285} cy={60} r={8} className="sim-node" />
            <text x={228} y={90} className="sim-label">
              branches reconverge
            </text>
          </g>
        )}
      </svg>
    </SimFrame>
  );
}
