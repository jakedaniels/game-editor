export type ShapeType = 'rectangle' | 'ellipse';

/** A drawable shape on the canvas. Coordinates are top-left based. */
export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Active editor tool. 'select' moves shapes; the others create shapes. */
export type Tool = 'select' | ShapeType;
