import { useRef, useState } from 'react';
import type { Shape as ShapeModel, Tool } from '../types';
import { Shape } from './Shape';

interface CanvasProps {
  tool: Tool;
  shapes: ShapeModel[];
  onShapesChange: (updater: (prev: ShapeModel[]) => ShapeModel[]) => void;
}

/** A shape being drawn (not yet committed). */
interface Draft {
  startX: number;
  startY: number;
  shape: ShapeModel;
}

/** An in-progress move of an existing shape. */
interface Move {
  id: string;
  offsetX: number;
  offsetY: number;
}

const MIN_SIZE = 4;

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function Canvas({ tool, shapes, onShapesChange }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [move, setMove] = useState<Move | null>(null);

  /** Pointer position relative to the SVG's top-left corner. */
  function getPoint(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleCanvasPointerDown(e: React.PointerEvent) {
    if (tool === 'select') return; // selection drags start on a shape, not the canvas
    const { x, y } = getPoint(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDraft({
      startX: x,
      startY: y,
      shape: { id: makeId(), type: tool, x, y, width: 0, height: 0 },
    });
  }

  function handleShapePointerDown(e: React.PointerEvent, shape: ShapeModel) {
    if (tool !== 'select') return; // let creation handle non-select tools on the canvas
    e.stopPropagation();
    const { x, y } = getPoint(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    setMove({ id: shape.id, offsetX: x - shape.x, offsetY: y - shape.y });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (draft) {
      const { x, y } = getPoint(e);
      setDraft({
        ...draft,
        shape: {
          ...draft.shape,
          x: Math.min(draft.startX, x),
          y: Math.min(draft.startY, y),
          width: Math.abs(x - draft.startX),
          height: Math.abs(y - draft.startY),
        },
      });
    } else if (move) {
      const { x, y } = getPoint(e);
      onShapesChange((prev) =>
        prev.map((s) =>
          s.id === move.id ? { ...s, x: x - move.offsetX, y: y - move.offsetY } : s,
        ),
      );
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (draft) {
      const { width, height } = draft.shape;
      if (width >= MIN_SIZE && height >= MIN_SIZE) {
        const committed = draft.shape;
        onShapesChange((prev) => [...prev, committed]);
      }
      setDraft(null);
    }
    setMove(null);
  }

  return (
    <svg
      ref={svgRef}
      className="canvas"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {shapes.map((shape) => (
        <Shape
          key={shape.id}
          shape={shape}
          selectable={tool === 'select'}
          onPointerDown={handleShapePointerDown}
        />
      ))}
      {draft && <Shape shape={draft.shape} selectable={false} />}
    </svg>
  );
}
