import { useState } from 'react';
import type { Shape, Tool } from '../types';
import { Toolbar } from '../components/Toolbar';
import { Canvas } from '../components/Canvas';

export default function ShapeEditorPage() {
  const [tool, setTool] = useState<Tool>('rectangle');
  const [shapes, setShapes] = useState<Shape[]>([]);

  return (
    <div className="shape-editor">
      <div className="shape-editor__toolbar">
        <Toolbar tool={tool} onToolChange={setTool} />
      </div>
      <Canvas tool={tool} shapes={shapes} onShapesChange={setShapes} />
    </div>
  );
}
