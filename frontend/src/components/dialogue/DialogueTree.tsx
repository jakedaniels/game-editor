import { useCallback, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  ReactFlow,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DialogueNode } from '../../api/client';
import './DialogueTree.css';

interface DialogueTreeProps {
  nodes: DialogueNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

type NodeData = { node: DialogueNode; selected: boolean };

const ROW_H = 150; // vertical gap between tree depths
const COL_W = 260; // horizontal gap between sibling leaves

/**
 * Tidy top-down layout, O(n): leaves take successive columns left-to-right; a parent centers over
 * its children. Multiple scene roots (no parent) are laid out as a left-to-right forest.
 */
function layoutTree(nodes: DialogueNode[]): Record<number, { x: number; y: number }> {
  const byId = new Map<number, DialogueNode>();
  const childrenOf = new Map<number, number[]>();
  for (const n of nodes) byId.set(n.id, n);
  for (const n of nodes) {
    if (n.parent_id != null && byId.has(n.parent_id)) {
      (childrenOf.get(n.parent_id) ?? childrenOf.set(n.parent_id, []).get(n.parent_id)!).push(n.id);
    }
  }
  const roots = nodes
    .filter((n) => n.parent_id == null || !byId.has(n.parent_id))
    .map((n) => n.id);

  const pos: Record<number, { x: number; y: number }> = {};
  let nextLeafX = 0;
  const assign = (id: number, depth: number): number => {
    const kids = childrenOf.get(id) ?? [];
    let x: number;
    if (kids.length === 0) {
      x = nextLeafX++;
    } else {
      const xs = kids.map((k) => assign(k, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    pos[id] = { x: x * COL_W, y: depth * ROW_H };
    return x;
  };
  for (const r of roots) assign(r, 0);
  return pos;
}

/** A compact node card — speaker avatar + name + truncated line. Reuses the app's avatar pattern. */
function DialogueTreeNode({ data }: NodeProps<Node<NodeData>>) {
  const { node, selected } = data;
  const speaker = node.character?.name ?? 'Unknown';
  return (
    <div className={`dtree-node${selected ? ' dtree-node--selected' : ''}`}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="dtree-node__head">
        <span className="dtree-node__avatar">
          {node.character?.image_url ? (
            <img className="dtree-node__avatar-img" src={node.character.image_url} alt="" />
          ) : (
            (speaker[0] ?? '?').toUpperCase()
          )}
        </span>
        <span className="dtree-node__speaker">{speaker}</span>
      </div>
      <div className="dtree-node__text">{node.text || '(no text)'}</div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { dialogue: DialogueTreeNode };

export function DialogueTree({ nodes, selectedId, onSelect }: DialogueTreeProps) {
  const rf = useRef<ReactFlowInstance<Node<NodeData>, Edge> | null>(null);

  // Clicking a node selects it (drives the inspector) and smoothly zooms in / centers on that box.
  const onNodeClick = useCallback(
    (_: unknown, node: Node<NodeData>) => {
      onSelect(Number(node.id));
      const w = node.measured?.width ?? 210;
      const h = node.measured?.height ?? 90;
      rf.current?.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: 1.3,
        duration: 450,
      });
    },
    [onSelect],
  );

  const { rfNodes, rfEdges } = useMemo(() => {
    const pos = layoutTree(nodes);
    const rfNodes: Node<NodeData>[] = nodes.map((n) => ({
      id: String(n.id),
      type: 'dialogue',
      position: pos[n.id] ?? { x: 0, y: 0 },
      data: { node: n, selected: n.id === selectedId },
    }));
    const rfEdges: Edge[] = nodes
      .filter((n) => n.parent_id != null)
      .map((n) => ({
        id: `e${n.parent_id}-${n.id}`,
        source: String(n.parent_id),
        target: String(n.id),
      }));
    return { rfNodes, rfEdges };
  }, [nodes, selectedId]);

  return (
    <div className="dtree">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onInit={(inst) => (rf.current = inst)}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
