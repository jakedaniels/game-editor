import { useCallback, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  Handle,
  ReactFlow,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { DialogueEffect, DialogueNode, DialogueRequirement } from '../../api/client';
import './DialogueTree.css';

interface DialogueTreeProps {
  nodes: DialogueNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

type NodeData = { node: DialogueNode; selected: boolean };

const ROW_H = 150; // vertical gap between tree depths
const COL_W = 260; // horizontal gap between sibling leaves

function getEffectBadge(effect: DialogueEffect) {
  if (effect.type === 'remember_choice') return '🧠 Remembered';
  if (effect.type === 'give_item') return '🎒 Gives item';
  if (effect.type === 'remove_item') return '🎒 Removes item';
  if (effect.type === 'change_stat') return '📈 Changes stat';
  if (effect.type === 'set_flag') return '🚩 Sets flag';
  return '⚡ Effect';
}

function getRequirementBadge(_requirement: DialogueRequirement) {
  return '🔒 Requirement';
}

/** The parent used for layout purposes when a node has more than one (first one wins; extra
 * incoming links still get their own edge line, just not a say in this node's position). */
function primaryParentId(node: DialogueNode, byId: Map<number, DialogueNode>): number | null {
  return node.parent_ids.find((id) => byId.has(id)) ?? null;
}

/**
 * Tidy top-down layout, O(n): leaves take successive columns left-to-right; a parent centers over
 * its children. Multiple scene roots (no incoming edges) are laid out as a left-to-right forest.
 * A node reachable from more than one parent is positioned under its first (primary) parent only;
 * the other links still render as edges, so the graph reads like a tree with occasional reconverging lines.
 */
function layoutTree(nodes: DialogueNode[]): Record<number, { x: number; y: number }> {
  const byId = new Map<number, DialogueNode>();
  const childrenOf = new Map<number, number[]>();
  for (const n of nodes) byId.set(n.id, n);
  for (const n of nodes) {
    const parentId = primaryParentId(n, byId);
    if (parentId != null) {
      (childrenOf.get(parentId) ?? childrenOf.set(parentId, []).get(parentId)!).push(n.id);
    }
  }
  const roots = nodes.filter((n) => primaryParentId(n, byId) == null).map((n) => n.id);

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
      {Boolean(node.requirements?.length || node.effects?.length) && (
        <div className="dialogue-badges dtree-node__badges">
          {((node.requirements ?? []) as DialogueRequirement[]).map((requirement, index) => (
            <span key={`requirement-${index}`} className="dialogue-badge dialogue-badge--requirement">
              {getRequirementBadge(requirement)}
            </span>
          ))}
          {((node.effects ?? []) as DialogueEffect[]).map((effect, index) => (
            <span
              key={`${effect.type}-${effect.state_key}-${index}`}
              className={`dialogue-badge dialogue-badge--${effect.type}`}
            >
              {getEffectBadge(effect)}
            </span>
          ))}
        </div>
      )}
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
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const pos = layoutTree(nodes);
    const rfNodes: Node<NodeData>[] = nodes.map((n) => ({
      id: String(n.id),
      type: 'dialogue',
      position: pos[n.id] ?? { x: 0, y: 0 },
      data: { node: n, selected: n.id === selectedId },
    }));
    const rfEdges: Edge[] = nodes.flatMap((n) =>
      n.parent_ids
        .filter((parentId) => byId.has(parentId))
        .map((parentId) => ({
          id: `e${parentId}-${n.id}`,
          source: String(parentId),
          target: String(n.id),
        })),
    );
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
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
