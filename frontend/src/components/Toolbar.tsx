import type { Tool } from '../types';

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
];

export function Toolbar({ tool, onToolChange }: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Editor tools">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toolbar__button${tool === t.id ? ' toolbar__button--active' : ''}`}
          aria-pressed={tool === t.id}
          onClick={() => onToolChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
