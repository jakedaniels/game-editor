/**
 * Reusable SVG figures for the system vignettes, built from primitives only.
 * All colors come from CSS classes (theme variables) — see SystemSims.css.
 */

export type KnightPose = 'idle' | 'flinch' | 'dead' | 'pant' | 'sag';

/** The mini knight. `x` is his center, `y` is the ground line his feet stand on. */
export function Knight({ x, y, scale = 1, pose = 'idle' }: { x: number; y: number; scale?: number; pose?: KnightPose }) {
  const squash = pose === 'flinch' ? 0.82 : 1;
  const lean = pose === 'pant' ? 18 : pose === 'sag' ? 10 : 0;
  if (pose === 'dead') {
    // Tipped over on his back, X eyes.
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <rect x={-14} y={-9} width={22} height={9} rx={4} className="sa-player" />
        <circle cx={12} cy={-5} r={5.5} className="sa-player" />
        <path d="M 10 -7 l 2 2 m 0 -2 l -2 2 M 13.5 -7 l 2 2 m 0 -2 l -2 2" className="sa-line" strokeWidth={1} />
        <path d="M -14 -2 l -5 -4 M -10 -1 l -4 -6" className="sa-line" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${lean}) scale(${scale} ${scale * squash})`}>
      {/* legs */}
      <path d="M -3 0 l -2 -8 M 3 0 l 2 -8" className="sa-line" />
      {/* body */}
      <rect x={-6} y={-22} width={12} height={15} rx={4} className="sa-player" />
      {/* head + helmet plume */}
      <circle cx={0} cy={-27} r={5.5} className="sa-player" />
      <path d="M 0 -32.5 q 4 -4 7 -2" className="sa-accent-line" />
      {/* eyes */}
      <circle cx={-1.8} cy={-27.5} r={0.9} className="sa-dot" />
      <circle cx={1.8} cy={-27.5} r={0.9} className="sa-dot" />
    </g>
  );
}

/**
 * The giant with a hammer. `x` is his center, `y` the ground line.
 * `swing` ∈ [0,1]: 0 = hammer raised high, 1 = hammer down on the bop point.
 */
export function Giant({ x, y, scale = 1, swing = 0, facing = -1 }: { x: number; y: number; scale?: number; swing?: number; facing?: -1 | 1 }) {
  const angle = -95 + swing * 120; // shoulder rotation, degrees
  return (
    <g transform={`translate(${x} ${y}) scale(${scale * facing} ${scale})`}>
      {/* legs */}
      <path d="M -7 0 l -2 -14 M 7 0 l 2 -14" className="sa-line" strokeWidth={2.5} />
      {/* body */}
      <rect x={-13} y={-48} width={26} height={35} rx={8} className="sa-threat" />
      {/* head */}
      <circle cx={0} cy={-56} r={9} className="sa-threat" />
      <circle cx={-3} cy={-57} r={1.2} className="sa-dot" />
      <circle cx={3} cy={-57} r={1.2} className="sa-dot" />
      <path d="M -3 -52.5 q 3 1.5 6 0" className="sa-line" strokeWidth={1} />
      {/* hammer arm, rotating at the shoulder */}
      <g transform={`translate(-11 -42) rotate(${angle})`}>
        <path d="M 0 0 L 22 0" className="sa-line" strokeWidth={2.5} />
        <path d="M 22 0 L 34 0" className="sa-line" strokeWidth={2} />
        <rect x={30} y={-8} width={9} height={16} rx={2} className="sa-threat sa-hammer" />
      </g>
    </g>
  );
}

/** The robed caster. `casting` raises the staff arm. */
export function Caster({ x, y, scale = 1, casting = false }: { x: number; y: number; scale?: number; casting?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* robe */}
      <path d="M -9 0 L -4 -24 L 4 -24 L 9 0 Z" className="sa-player" />
      {/* head + hood */}
      <circle cx={0} cy={-28} r={5} className="sa-player" />
      <path d="M -5.5 -28 Q 0 -38 5.5 -28" className="sa-accent-line" />
      {/* staff arm */}
      <g transform={`rotate(${casting ? -35 : -10} 4 -22)`}>
        <path d="M 4 -22 L 14 -26" className="sa-line" />
        <path d="M 14 -40 L 14 -12" className="sa-line" strokeWidth={1.6} />
        <circle cx={14} cy={-41} r={2.6} className="sa-orb" />
      </g>
    </g>
  );
}
