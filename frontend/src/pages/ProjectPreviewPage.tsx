import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEFAULT_HUD_LAYOUT,
  SYSTEM_LABELS,
  normalizeHudLayout,
  normalizeSystems,
  type HudLayout,
  type HudPos,
} from '../lib/gameSystems';
import { useProject } from './ProjectHomePage';
import './ProjectTabs.css';

function zoneOf(pos: HudPos): string {
  const v = pos.y < 33 ? 'top' : pos.y > 66 ? 'bottom' : 'middle';
  const h = pos.x < 33 ? 'left' : pos.x > 60 ? 'right' : 'center';
  if (v === 'middle' && h === 'center') return 'center';
  return `${v}-${h}`;
}

export default function ProjectPreviewPage() {
  const { project, patchProject } = useProject();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const systems = useMemo(() => normalizeSystems(project.systems), [project.systems]);
  const [layout, setLayout] = useState<HudLayout>(() => normalizeHudLayout(project.hud_layout));
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Debounced persist of HUD positions (skip the initial mount).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => void patchProject({ hud_layout: layout }), 400);
    return () => clearTimeout(t);
  }, [layout, patchProject]);

  const setPos = useCallback(
    (id: string, pos: HudPos) => setLayout((prev) => ({ ...prev, [id]: pos })),
    [],
  );

  const enabled = (id: string) => systems[id]?.enabled;
  const goEdit = () => navigate(`/projects/${projectId}/systems`);

  const healthDisplay = (systems.health?.values['display'] as string) ?? 'hearts';
  const inventorySlots = (systems.inventory?.values['slots'] as number) ?? 6;
  const magicSchools = (systems.magic?.values['schools'] as string[]) ?? [];

  const activeSystems = Object.keys(SYSTEM_LABELS).filter((k) => enabled(k));
  const instructions = activeSystems.map((id) => {
    const pos = layout[id] ?? { x: 50, y: 50 };
    return { id, label: SYSTEM_LABELS[id], zone: zoneOf(pos), pos };
  });

  function copyInstructions() {
    const text = instructions
      .map(
        (i) =>
          `- ${i.label}: ${i.zone.replace('-', ' ')} (x≈${Math.round(i.pos.x)}%, y≈${Math.round(
            i.pos.y,
          )}%)`,
      )
      .join('\n');
    void navigator.clipboard.writeText(
      `HUD Layout Instructions\n${text}\n\nGenerated for AI game maker.`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="ptab pprev">
      <p className="ptab__lead">
        A retro preview of your design. Drag any HUD element to position it; click one to jump to
        its system settings. Positions are saved to the project.
      </p>

      <div className="pprev__grid">
        <div>
          <div ref={stageRef} className="pprev__stage" style={STAGE_STYLE}>
            <Stars />
            <div className="pprev__sun" />
            <GroundTiles />
            <PixelHero />
            {dragging && <QuadrantGuides />}

            {enabled('health') && (
              <Draggable id="health" pos={layout.health} stageRef={stageRef} onEdit={goEdit} setPos={setPos} setDragging={setDragging} active={dragging === 'health'}>
                <HudCluster label="HEALTH">
                  <HealthRender display={healthDisplay} />
                </HudCluster>
              </Draggable>
            )}
            {enabled('magic') && (
              <Draggable id="magic" pos={layout.magic} stageRef={stageRef} onEdit={goEdit} setPos={setPos} setDragging={setDragging} active={dragging === 'magic'}>
                <HudCluster label="MAGIC">
                  <MagicRender schools={magicSchools} />
                </HudCluster>
              </Draggable>
            )}
            {enabled('stamina') && (
              <Draggable id="stamina" pos={layout.stamina} stageRef={stageRef} onEdit={goEdit} setPos={setPos} setDragging={setDragging} active={dragging === 'stamina'}>
                <HudCluster label="STAMINA">
                  <Bar width={112} fill={0.66} color="#34d399" />
                </HudCluster>
              </Draggable>
            )}
            {enabled('inventory') && (
              <Draggable id="inventory" pos={layout.inventory} stageRef={stageRef} onEdit={goEdit} setPos={setPos} setDragging={setDragging} active={dragging === 'inventory'}>
                <HudCluster label="INVENTORY">
                  <InventoryGrid slots={inventorySlots} />
                </HudCluster>
              </Draggable>
            )}
            {enabled('combat') && (
              <Draggable id="combat" pos={layout.combat} stageRef={stageRef} onEdit={goEdit} setPos={setPos} setDragging={setDragging} active={dragging === 'combat'}>
                <HudCluster label="WEAPON">
                  <WeaponSlot />
                </HudCluster>
              </Draggable>
            )}
            {enabled('dialogue') && (
              <Draggable id="dialogue" pos={layout.dialogue} stageRef={stageRef} onEdit={goEdit} setPos={setPos} setDragging={setDragging} active={dragging === 'dialogue'}>
                <DialogueBox />
              </Draggable>
            )}

            {activeSystems.length === 0 && (
              <div className="pprev__empty">
                No systems enabled yet — enable some on the Systems tab.
              </div>
            )}
          </div>
          <p className="pprev__hint">Drag to reposition · Click to edit</p>
        </div>

        <aside className="pprev__panel">
          <div className="pprev__panel-head">
            <h2 className="ptab__section-title">Layout Instructions</h2>
            <div className="pprev__panel-actions">
              <button type="button" className="btn" onClick={() => setLayout({ ...DEFAULT_HUD_LAYOUT })}>
                Reset
              </button>
              <button type="button" className="btn btn--primary" onClick={copyInstructions}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          </div>
          <p className="pprev__panel-note">Relative placement passed to the AI game maker.</p>
          {instructions.length === 0 ? (
            <div className="pprev__panel-empty">Enable systems to see them here.</div>
          ) : (
            <ul className="pprev__list">
              {instructions.map((i) => (
                <li key={i.id} className="pprev__list-row">
                  <button type="button" className="pprev__list-name" onClick={goEdit}>
                    {i.label}
                  </button>
                  <span className="pprev__list-zone">{i.zone.replace('-', ' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------- Draggable wrapper ----------

function Draggable({
  id,
  pos,
  stageRef,
  children,
  onEdit,
  setPos,
  setDragging,
  active,
}: {
  id: string;
  pos: HudPos;
  stageRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  onEdit: (id: string) => void;
  setPos: (id: string, pos: HudPos) => void;
  setDragging: (id: string | null) => void;
  active: boolean;
}) {
  const movedRef = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    if (!grabbing) return;
    const onMove = (e: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      movedRef.current = true;
      setPos(id, { x: Math.max(0, Math.min(92, x - 4)), y: Math.max(0, Math.min(92, y - 4)) });
    };
    const onUp = () => {
      setGrabbing(false);
      setDragging(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [grabbing, id, stageRef, setPos, setDragging]);

  return (
    <div
      className="pprev__drag"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: active ? 20 : 10, cursor: grabbing ? 'grabbing' : 'grab' }}
      onPointerDown={(e) => {
        e.preventDefault();
        movedRef.current = false;
        setGrabbing(true);
        setDragging(id);
      }}
      onClick={(e) => {
        if (movedRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onEdit(id);
      }}
    >
      <div style={active ? { outline: '2px solid var(--green)', borderRadius: 3 } : undefined}>
        {children}
      </div>
    </div>
  );
}

function QuadrantGuides() {
  return (
    <div className="pprev__guides">
      <span style={{ top: '33.33%', left: 0, right: 0, borderTop: '1px dashed color-mix(in srgb, var(--green) 30%, transparent)' }} />
      <span style={{ bottom: '33.33%', left: 0, right: 0, borderTop: '1px dashed color-mix(in srgb, var(--green) 30%, transparent)' }} />
      <span style={{ left: '33.33%', top: 0, bottom: 0, borderLeft: '1px dashed color-mix(in srgb, var(--green) 30%, transparent)' }} />
      <span style={{ right: '33.33%', top: 0, bottom: 0, borderLeft: '1px dashed color-mix(in srgb, var(--green) 30%, transparent)' }} />
    </div>
  );
}

// ---------- HUD framing + pieces ----------

function HudCluster({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="pprev__hud-label">{label}</div>
      <div className="pprev__hud-box">{children}</div>
    </div>
  );
}

function Bar({ width, fill, color }: { width: number; fill: number; color: string }) {
  return (
    <div style={{ width, height: 12, background: '#0f1115', boxShadow: 'inset 0 0 0 1px #3f3f46' }}>
      <div style={{ height: '100%', width: `${fill * 100}%`, background: color }} />
    </div>
  );
}

function HealthRender({ display }: { display: string }) {
  if (display === 'numeric')
    return <div style={{ fontFamily: 'monospace', fontSize: 18, color: '#f87171', textShadow: '2px 2px 0 #000' }}>HP 80/100</div>;
  if (display === 'bar') return <Bar width={128} fill={0.8} color="#ef4444" />;
  if (display === 'hidden') return <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#71717a' }}>— hidden —</div>;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <PixelHeart key={i} filled={i <= 4} />
      ))}
    </div>
  );
}

function PixelHeart({ filled }: { filled: boolean }) {
  const color = filled ? '#ef4444' : '#3f3f46';
  const grid = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 4px)' }}>
      {grid.flat().map((cell, i) => (
        <div key={i} style={{ width: 4, height: 4, background: cell ? color : 'transparent' }} />
      ))}
    </div>
  );
}

function MagicRender({ schools }: { schools: string[] }) {
  const palette: Record<string, string> = {
    fire: '#f97316',
    frost: '#38bdf8',
    nature: '#22c55e',
    arcane: '#a855f7',
    shadow: '#71717a',
  };
  const list = schools.length ? schools : ['arcane'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Bar width={96} fill={0.6} color="#0ea5e9" />
      <div style={{ display: 'flex', gap: 4 }}>
        {list.slice(0, 4).map((s) => (
          <div key={s} title={s} style={{ width: 12, height: 12, background: palette[s] ?? '#a855f7', boxShadow: '0 0 4px currentColor' }} />
        ))}
      </div>
    </div>
  );
}

function InventoryGrid({ slots }: { slots: number }) {
  const visible = Math.min(slots, 8);
  const filled = [true, true, false, true, false, false, true, false];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
      {Array.from({ length: visible }).map((_, i) => (
        <div key={i} style={{ width: 24, height: 24, boxShadow: 'inset 0 0 0 1px #3f3f46', background: filled[i % filled.length] ? '#52525b' : '#18181b' }}>
          {filled[i % filled.length] && <div style={{ margin: 4, width: 16, height: 16, background: '#fbbf24' }} />}
        </div>
      ))}
    </div>
  );
}

function WeaponSlot() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, background: '#18181b', boxShadow: 'inset 0 0 0 1px #3f3f46', color: '#fcd34d' }}>⚔</div>
      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#d4d4d8' }}>IRON SWORD</div>
    </div>
  );
}

function DialogueBox() {
  return (
    <div style={{ width: 280, borderRadius: 3, background: 'rgba(0,0,0,0.8)', padding: 12, boxShadow: '0 0 0 2px rgba(228,228,231,0.8)' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', color: '#a1a1aa', textTransform: 'uppercase' }}>Old Wizard</div>
      <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12, color: '#f4f4f5' }}>
        "So you've come at last. The realm has need of a hero..."
      </div>
      <div style={{ marginTop: 8, textAlign: 'right', fontFamily: 'monospace', fontSize: 10, color: '#6ee7b7' }}>▼</div>
    </div>
  );
}

// ---------- Scenery ----------

function Stars() {
  const stars = [
    [12, 18], [40, 32], [70, 14], [88, 40], [55, 8], [22, 48], [78, 28],
  ];
  return (
    <>
      {stars.map(([x, y], i) => (
        <div key={i} style={{ position: 'absolute', width: 4, height: 4, background: '#fff', left: `${x}%`, top: `${y}%` }} />
      ))}
    </>
  );
}

function GroundTiles() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: '33.33%',
        width: '100%',
        background: 'repeating-linear-gradient(90deg, #3f2810 0 24px, #4a3015 24px 48px)',
        boxShadow: 'inset 0 4px 0 0 #5a3a1c',
      }}
    />
  );
}

function PixelHero() {
  const B = '#000';
  const S = '#fcd9b6';
  const H = '#3b2a1a';
  const T = '#16a34a';
  const P = '#1e3a8a';
  const _ = null;
  const px = [
    [_, _, B, B, B, B, _, _],
    [_, B, H, H, H, H, B, _],
    [_, B, S, S, S, S, B, _],
    [_, B, S, B, S, B, B, _],
    [_, _, B, S, S, B, _, _],
    [_, B, T, T, T, T, B, _],
    [B, T, T, T, T, T, T, B],
    [_, B, P, P, P, P, B, _],
    [_, B, P, B, B, P, B, _],
    [_, B, B, _, _, B, B, _],
  ];
  return (
    <div style={{ position: 'absolute', bottom: '18%', left: '50%', transform: 'translateX(-50%)', display: 'grid', gridTemplateColumns: 'repeat(8, 6px)' }}>
      {px.flat().map((c, i) => (
        <div key={i} style={{ width: 6, height: 6, background: c ?? 'transparent' }} />
      ))}
    </div>
  );
}

const STAGE_STYLE: React.CSSProperties = {
  imageRendering: 'pixelated',
  background: 'linear-gradient(#0b1d2a 0%, #0b1d2a 55%, #2a1b0e 55%, #2a1b0e 100%)',
  boxShadow: 'inset 0 0 0 4px #000, inset 0 0 0 8px #1f2937, 0 30px 60px -20px rgba(0,0,0,0.8)',
};
