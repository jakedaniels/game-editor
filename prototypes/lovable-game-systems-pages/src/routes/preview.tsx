import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeft, RotateCcw, Copy, Check } from "lucide-react";
import {
  useGameStore,
  setHudPos,
  resetHudLayout,
  type ArchitectState,
  type HudPos,
} from "@/lib/game-store";

export const Route = createFileRoute("/preview")({
  head: () => ({
    meta: [
      { title: "Preview — Game Architect" },
      {
        name: "description",
        content:
          "A retro-flavoured preview of your design. Drag HUD elements to set their on-screen placement.",
      },
    ],
  }),
  component: PreviewPage,
});

type EnabledMap = Record<string, boolean>;

function enabledOf(state: ArchitectState | null): EnabledMap {
  if (!state) return {};
  const out: EnabledMap = {};
  for (const [k, v] of Object.entries(state)) out[k] = !!v?.enabled;
  return out;
}

function zoneOf(pos: HudPos): string {
  const v = pos.y < 33 ? "top" : pos.y > 66 ? "bottom" : "middle";
  const h = pos.x < 33 ? "left" : pos.x > 60 ? "right" : "center";
  if (v === "middle" && h === "center") return "center";
  return `${v}-${h}`;
}

const SYSTEM_LABELS: Record<string, string> = {
  health: "Health",
  magic: "Magic",
  stamina: "Stamina",
  inventory: "Inventory",
  combat: "Weapon",
  dialogue: "Dialogue",
};

function PreviewPage() {
  const navigate = useNavigate();
  const { gameType, architect, hudLayout } = useGameStore();
  const enabled = useMemo(() => enabledOf(architect), [architect]);
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const goTo = (systemId: string) =>
    navigate({ to: "/architect", search: { focus: systemId } });

  const healthDisplay =
    (architect?.health?.values["display"] as string | undefined) ?? "hearts";
  const inventorySlots =
    (architect?.inventory?.values["slots"] as number | undefined) ?? 6;
  const magicSchools =
    (architect?.magic?.values["schools"] as string[] | undefined) ?? [];

  const activeSystems = Object.keys(SYSTEM_LABELS).filter((k) => enabled[k]);

  const instructions = useMemo(
    () =>
      activeSystems.map((id) => {
        const pos = hudLayout[id] ?? { x: 50, y: 50 };
        return {
          id,
          label: SYSTEM_LABELS[id],
          zone: zoneOf(pos),
          pos,
        };
      }),
    [activeSystems, hudLayout],
  );

  const [copied, setCopied] = useState(false);
  const copyInstructions = () => {
    const text = instructions
      .map(
        (i) =>
          `- ${i.label}: ${i.zone.replace("-", " ")} (x≈${Math.round(i.pos.x)}%, y≈${Math.round(i.pos.y)}%)`,
      )
      .join("\n");
    navigator.clipboard.writeText(
      `HUD Layout Instructions\n${text}\n\nGenerated for AI game maker.`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
      <header className="border-b border-zinc-800 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="space-y-1">
            <Link
              to="/architect"
              className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-zinc-500 uppercase hover:text-zinc-100"
            >
              <ArrowLeft className="size-3" /> Back to architect
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">Game Preview</h1>
            <p className="max-w-[60ch] text-sm text-zinc-400">
              Drag any HUD element to position it. Click (without dragging) to edit that system.
            </p>
          </div>
          <div className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
            {gameType.dimension ?? "—"} · {gameType.genre ?? "—"}
          </div>
        </div>
      </header>

      <main className="py-10">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div
              ref={stageRef}
              className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-lg select-none"
              style={{
                imageRendering: "pixelated",
                background:
                  "linear-gradient(#0b1d2a 0%, #0b1d2a 55%, #2a1b0e 55%, #2a1b0e 100%)",
                boxShadow:
                  "inset 0 0 0 4px #000, inset 0 0 0 8px #1f2937, 0 30px 60px -20px rgba(0,0,0,0.8)",
              }}
            >
              <Stars />
              <div
                className="absolute top-8 right-12 size-10"
                style={{
                  background: "#fde047",
                  boxShadow: "0 0 0 4px #facc15, 0 0 32px 8px rgba(253,224,71,0.4)",
                }}
              />
              <GroundTiles />
              <PixelHero />

              {/* Quadrant guides while dragging */}
              {dragging && <QuadrantGuides />}

              {enabled.health && (
                <Draggable
                  id="health"
                  pos={hudLayout.health}
                  stageRef={stageRef}
                  onClickSystem={goTo}
                  setDragging={setDragging}
                >
                  <HudCluster label="HEALTH">
                    <HealthRender display={healthDisplay} />
                  </HudCluster>
                </Draggable>
              )}
              {enabled.magic && (
                <Draggable
                  id="magic"
                  pos={hudLayout.magic}
                  stageRef={stageRef}
                  onClickSystem={goTo}
                  setDragging={setDragging}
                >
                  <HudCluster label="MAGIC">
                    <MagicRender schools={magicSchools} />
                  </HudCluster>
                </Draggable>
              )}
              {enabled.stamina && (
                <Draggable
                  id="stamina"
                  pos={hudLayout.stamina}
                  stageRef={stageRef}
                  onClickSystem={goTo}
                  setDragging={setDragging}
                >
                  <HudCluster label="STAMINA">
                    <StaminaBar />
                  </HudCluster>
                </Draggable>
              )}
              {enabled.inventory && (
                <Draggable
                  id="inventory"
                  pos={hudLayout.inventory}
                  stageRef={stageRef}
                  onClickSystem={goTo}
                  setDragging={setDragging}
                >
                  <HudCluster label="INVENTORY">
                    <InventoryGrid slots={inventorySlots} />
                  </HudCluster>
                </Draggable>
              )}
              {enabled.combat && (
                <Draggable
                  id="combat"
                  pos={hudLayout.combat}
                  stageRef={stageRef}
                  onClickSystem={goTo}
                  setDragging={setDragging}
                >
                  <HudCluster label="WEAPON">
                    <WeaponSlot />
                  </HudCluster>
                </Draggable>
              )}
              {enabled.dialogue && (
                <Draggable
                  id="dialogue"
                  pos={hudLayout.dialogue}
                  stageRef={stageRef}
                  onClickSystem={goTo}
                  setDragging={setDragging}
                >
                  <DialogueBox />
                </Draggable>
              )}

              {activeSystems.length === 0 && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="rounded-md bg-black/60 px-4 py-3 text-center font-mono text-xs text-zinc-300">
                    No systems enabled yet.
                    <br />
                    <Link to="/architect" className="underline">
                      Go enable something
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-4 text-center font-mono text-[11px] tracking-widest text-zinc-500 uppercase">
              Drag to reposition · Click to edit
            </p>
          </div>

          {/* Instructions panel */}
          <aside className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Layout Instructions
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => resetHudLayout()}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  title="Reset positions"
                >
                  <RotateCcw className="size-3.5" />
                </button>
                <button
                  onClick={copyInstructions}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  title="Copy instructions"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
            <p className="mb-3 text-[11px] text-zinc-500">
              Relative placement passed to the AI game maker.
            </p>
            {instructions.length === 0 ? (
              <div className="text-xs text-zinc-500">
                Enable systems on the architect page to see them here.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {instructions.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5"
                  >
                    <button
                      onClick={() => goTo(i.id)}
                      className="text-xs font-medium text-zinc-100 hover:text-emerald-400"
                    >
                      {i.label}
                    </button>
                    <span className="font-mono text-[10px] tracking-wider text-emerald-300 uppercase">
                      {i.zone.replace("-", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 rounded border border-zinc-800 bg-black/40 p-2.5 font-mono text-[10px] leading-relaxed text-zinc-400">
              {instructions.length === 0
                ? "// no HUD elements"
                : instructions
                    .map(
                      (i) =>
                        `${i.id}: ${i.zone}  // x=${Math.round(i.pos.x)}% y=${Math.round(i.pos.y)}%`,
                    )
                    .join("\n")}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ---------- Draggable wrapper ----------

function Draggable({
  id,
  pos,
  stageRef,
  children,
  onClickSystem,
  setDragging,
}: {
  id: string;
  pos: HudPos;
  stageRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  onClickSystem: (id: string) => void;
  setDragging: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const clamped = {
        x: Math.max(0, Math.min(92, x - 4)),
        y: Math.max(0, Math.min(92, y - 4)),
      };
      movedRef.current = true;
      setHudPos(id, clamped);
    };
    const onUp = () => {
      setActive(false);
      setDragging(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [active, id, stageRef, setDragging]);

  return (
    <div
      ref={ref}
      className={`absolute cursor-grab touch-none ${active ? "z-20 cursor-grabbing" : "z-10"}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      onPointerDown={(e) => {
        e.preventDefault();
        movedRef.current = false;
        setActive(true);
        setDragging(id);
      }}
      onClick={(e) => {
        if (movedRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClickSystem(id);
      }}
    >
      <div className={active ? "ring-2 ring-emerald-400 rounded-sm" : ""}>
        {children}
      </div>
    </div>
  );
}

function QuadrantGuides() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-1/3 right-0 left-0 border-t border-dashed border-emerald-400/30" />
      <div className="absolute right-0 bottom-1/3 left-0 border-t border-dashed border-emerald-400/30" />
      <div className="absolute top-0 bottom-0 left-1/3 border-l border-dashed border-emerald-400/30" />
      <div className="absolute top-0 right-1/3 bottom-0 border-l border-dashed border-emerald-400/30" />
    </div>
  );
}

// ---------- HUD framing ----------

function HudCluster({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div
        className="font-mono text-[9px] tracking-widest text-zinc-300 uppercase"
        style={{ textShadow: "1px 1px 0 #000" }}
      >
        {label}
      </div>
      <div className="mt-1 inline-block rounded-sm bg-black/40 p-1.5 ring-1 ring-zinc-700/60">
        {children}
      </div>
    </div>
  );
}

// ---------- HUD pieces ----------

function HealthRender({ display }: { display: string }) {
  if (display === "numeric") {
    return (
      <div className="font-mono text-lg text-red-400" style={{ textShadow: "2px 2px 0 #000" }}>
        HP 80/100
      </div>
    );
  }
  if (display === "bar") {
    return (
      <div className="h-3 w-32 bg-zinc-900 ring-1 ring-zinc-700">
        <div className="h-full w-4/5 bg-red-500" />
      </div>
    );
  }
  if (display === "hidden") {
    return <div className="font-mono text-[10px] text-zinc-500">— hidden —</div>;
  }
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <PixelHeart key={i} filled={i <= 4} />
      ))}
    </div>
  );
}

function PixelHeart({ filled }: { filled: boolean }) {
  const color = filled ? "#ef4444" : "#3f3f46";
  const grid = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ];
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(7, 4px)" }}>
      {grid.flat().map((cell, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            background: cell ? color : "transparent",
          }}
        />
      ))}
    </div>
  );
}

function MagicRender({ schools }: { schools: string[] }) {
  const palette: Record<string, string> = {
    fire: "#f97316",
    frost: "#38bdf8",
    nature: "#22c55e",
    arcane: "#a855f7",
    shadow: "#71717a",
  };
  const list = schools.length ? schools : ["arcane"];
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 w-24 bg-zinc-900 ring-1 ring-zinc-700">
        <div className="h-full w-3/5 bg-sky-500" />
      </div>
      <div className="flex gap-1">
        {list.slice(0, 4).map((s) => (
          <div
            key={s}
            className="size-3"
            title={s}
            style={{ background: palette[s] ?? "#a855f7", boxShadow: "0 0 4px currentColor" }}
          />
        ))}
      </div>
    </div>
  );
}

function StaminaBar() {
  return (
    <div className="h-2 w-28 bg-zinc-900 ring-1 ring-zinc-700">
      <div className="h-full w-2/3 bg-emerald-400" />
    </div>
  );
}

function InventoryGrid({ slots }: { slots: number }) {
  const visible = Math.min(slots, 8);
  const filled = [true, true, false, true, false, false, true, false];
  return (
    <div className="grid grid-cols-4 gap-1">
      {Array.from({ length: visible }).map((_, i) => (
        <div
          key={i}
          className="size-6 ring-1 ring-zinc-700"
          style={{
            background: filled[i % filled.length] ? "#52525b" : "#18181b",
          }}
        >
          {filled[i % filled.length] && (
            <div className="m-1 size-4 bg-amber-400" />
          )}
        </div>
      ))}
    </div>
  );
}

function WeaponSlot() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid size-8 place-items-center bg-zinc-900 ring-1 ring-zinc-700">
        <div className="text-amber-300">⚔</div>
      </div>
      <div className="font-mono text-[10px] text-zinc-300">IRON SWORD</div>
    </div>
  );
}

function DialogueBox() {
  return (
    <div className="w-[280px] rounded-sm bg-black/80 p-3 ring-2 ring-zinc-200/80">
      <div className="font-mono text-[9px] tracking-widest text-zinc-400 uppercase">
        Old Wizard
      </div>
      <div className="mt-1 font-mono text-xs text-zinc-100">
        "So you've come at last. The realm has need of a hero..."
      </div>
      <div className="mt-2 flex justify-end">
        <span className="font-mono text-[10px] text-emerald-300">▼</span>
      </div>
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
        <div
          key={i}
          className="absolute size-1 bg-white"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </>
  );
}

function GroundTiles() {
  return (
    <div
      className="absolute bottom-0 left-0 h-1/3 w-full"
      style={{
        background:
          "repeating-linear-gradient(90deg, #3f2810 0 24px, #4a3015 24px 48px)",
        boxShadow: "inset 0 4px 0 0 #5a3a1c",
      }}
    />
  );
}

function PixelHero() {
  const B = "#000";
  const S = "#fcd9b6";
  const H = "#3b2a1a";
  const T = "#16a34a";
  const P = "#1e3a8a";
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
    <div
      className="absolute bottom-[18%] left-1/2 -translate-x-1/2"
      style={{ display: "grid", gridTemplateColumns: "repeat(8, 6px)" }}
    >
      {px.flat().map((c, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            background: c ?? "transparent",
          }}
        />
      ))}
    </div>
  );
}
