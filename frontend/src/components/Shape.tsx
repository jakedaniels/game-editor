import type { Shape as ShapeModel } from '../types';

interface ShapeProps {
  shape: ShapeModel;
  selectable: boolean;
  onPointerDown?: (e: React.PointerEvent, shape: ShapeModel) => void;
}

/** Renders a single shape as an SVG outline (no fill). */
export function Shape({ shape, selectable, onPointerDown }: ShapeProps) {
  const common = {
    className: 'shape-outline',
    stroke: '#2be07a',
    strokeWidth: 2,
    fill: 'none' as const,
    style: { cursor: selectable ? 'move' : 'default' },
    onPointerDown: (e: React.PointerEvent) => onPointerDown?.(e, shape),
  };

  if (shape.type === 'ellipse') {
    return (
      <ellipse
        cx={shape.x + shape.width / 2}
        cy={shape.y + shape.height / 2}
        rx={shape.width / 2}
        ry={shape.height / 2}
        {...common}
      />
    );
  }

  return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} {...common} />;
}
