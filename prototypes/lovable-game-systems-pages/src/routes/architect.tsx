import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  Zap,
  Sparkles,
  Package,
  Sword,
  MessagesSquare,
  Footprints,
  Eye,
  Check,
  Copy,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  setArchitect,
  useGameStore,
  type ArchitectState,
} from "@/lib/game-store";

export const Route = createFileRoute("/architect")({
  validateSearch: (s: Record<string, unknown>) => ({
    focus: typeof s.focus === "string" ? s.focus : undefined,
  }),
  head: () => ({
    meta: [
      { title: "System Architect — Configure your game systems" },
      {
        name: "description",
        content:
          "Configure each game system, then preview your design.",
      },
    ],
  }),
  component: SystemArchitect,
});

// ---------- types ----------

type Scope = "all" | "player" | "tagged";

type OptionDef = {
  id: string;
  label: string;
  description?: string;
};

type QuestionDef =
  | { kind: "single"; key: string; label: string; options: OptionDef[]; defaultValue: string }
  | { kind: "multi"; key: string; label: string; options: OptionDef[]; defaultValue: string[] }
  | { kind: "slider"; key: string; label: string; min: number; max: number; step: number; unit: string; defaultValue: number };

type SystemDef = {
  id: string;
  name: string;
  blurb: string;
  icon: typeof Heart;
  questions: QuestionDef[];
  components: string[];
};

const SCOPE_OPTIONS: OptionDef[] = [
  { id: "all", label: "All entities", description: "Every character shares this" },
  { id: "player", label: "Only player", description: "Just the playable character" },
  { id: "tagged", label: "Tagged group", description: "Only specific character types" },
];

const SYSTEMS: SystemDef[] = [
  {
    id: "health",
    name: "Health",
    blurb: "Vitality, damage, and death",
    icon: Heart,
    components: ["HealthComponent"],
    questions: [
      { kind: "single", key: "scope", label: "Who has health?", options: SCOPE_OPTIONS, defaultValue: "all" },
      {
        kind: "single",
        key: "regen",
        label: "How is it restored?",
        options: [
          { id: "auto", label: "Auto-regeneration", description: "Heals over time when out of combat" },
          { id: "pickup", label: "Consumable pickups", description: "Player must collect items" },
          { id: "rest", label: "Rest / save points", description: "Restored at specific locations" },
          { id: "never", label: "Never", description: "Damage is permanent until death" },
        ],
        defaultValue: "auto",
      },
      {
        kind: "single",
        key: "display",
        label: "Visual representation",
        options: [
          { id: "bar", label: "Bar" },
          { id: "hearts", label: "Hearts" },
          { id: "numeric", label: "Numeric" },
          { id: "hidden", label: "Hidden" },
        ],
        defaultValue: "hearts",
      },
      { kind: "slider", key: "lethality", label: "Lethality threshold", min: 0, max: 100, step: 5, unit: "% HP", defaultValue: 65 },
    ],
  },
  {
    id: "stamina",
    name: "Stamina",
    blurb: "Sprint, jump, and exertion",
    icon: Footprints,
    components: ["StaminaComponent"],
    questions: [
      { kind: "single", key: "scope", label: "Who has stamina?", options: SCOPE_OPTIONS, defaultValue: "all" },
      {
        kind: "multi",
        key: "drains",
        label: "What drains stamina?",
        options: [
          { id: "sprint", label: "Sprinting" },
          { id: "jump", label: "Jumping" },
          { id: "attack", label: "Attacking" },
          { id: "block", label: "Blocking" },
        ],
        defaultValue: ["sprint", "jump"],
      },
      { kind: "slider", key: "regenRate", label: "Regen rate", min: 1, max: 50, step: 1, unit: "/sec", defaultValue: 12 },
    ],
  },
  {
    id: "magic",
    name: "Magic / Mana",
    blurb: "Spells, mana, and cooldowns",
    icon: Sparkles,
    components: ["ManaPool", "SpellCaster"],
    questions: [
      { kind: "single", key: "scope", label: "Who can cast?", options: SCOPE_OPTIONS, defaultValue: "tagged" },
      {
        kind: "single",
        key: "resource",
        label: "Resource model",
        options: [
          { id: "mana", label: "Mana pool", description: "Spend from a refillable pool" },
          { id: "cooldown", label: "Cooldowns", description: "Each spell on its own timer" },
          { id: "charges", label: "Charges", description: "Limited uses per encounter" },
        ],
        defaultValue: "mana",
      },
      {
        kind: "multi",
        key: "schools",
        label: "Spell schools",
        options: [
          { id: "fire", label: "Fire" },
          { id: "frost", label: "Frost" },
          { id: "nature", label: "Nature" },
          { id: "arcane", label: "Arcane" },
          { id: "shadow", label: "Shadow" },
        ],
        defaultValue: ["fire", "frost"],
      },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    blurb: "Items, slots, and weight",
    icon: Package,
    components: ["InventoryController"],
    questions: [
      { kind: "single", key: "scope", label: "Who carries an inventory?", options: SCOPE_OPTIONS, defaultValue: "player" },
      {
        kind: "single",
        key: "capacity",
        label: "Capacity model",
        options: [
          { id: "slots", label: "Slot-based" },
          { id: "weight", label: "Weight-based" },
          { id: "unlimited", label: "Unlimited" },
        ],
        defaultValue: "slots",
      },
      { kind: "slider", key: "slots", label: "Default slots", min: 4, max: 64, step: 1, unit: "slots", defaultValue: 12 },
    ],
  },
  {
    id: "combat",
    name: "Combat",
    blurb: "How damage is dealt",
    icon: Sword,
    components: ["CombatComponent"],
    questions: [
      { kind: "single", key: "scope", label: "Who can fight?", options: SCOPE_OPTIONS, defaultValue: "all" },
      {
        kind: "multi",
        key: "modes",
        label: "Combat modes",
        options: [
          { id: "melee", label: "Melee" },
          { id: "ranged", label: "Ranged" },
          { id: "magic", label: "Magical" },
        ],
        defaultValue: ["melee"],
      },
    ],
  },
  {
    id: "dialogue",
    name: "Dialogue",
    blurb: "Conversations and choices",
    icon: MessagesSquare,
    components: ["DialogueController"],
    questions: [
      { kind: "single", key: "scope", label: "Who speaks?", options: SCOPE_OPTIONS, defaultValue: "tagged" },
      {
        kind: "single",
        key: "branching",
        label: "Branching",
        options: [
          { id: "linear", label: "Linear", description: "One line at a time" },
          { id: "choice", label: "Player choice", description: "Player picks responses" },
          { id: "tree", label: "Full dialogue tree", description: "Conditional, stateful branches" },
        ],
        defaultValue: "choice",
      },
    ],
  },
];

function defaultValues(sys: SystemDef): Record<string, string | string[] | number> {
  const out: Record<string, string | string[] | number> = {};
  for (const q of sys.questions) out[q.key] = q.defaultValue as string | string[] | number;
  return out;
}

function initialState(): ArchitectState {
  const out: ArchitectState = {};
  for (const s of SYSTEMS) {
    out[s.id] = {
      enabled: ["health", "inventory", "stamina"].includes(s.id),
      values: defaultValues(s),
    };
  }
  return out;
}

// Defaults tuned to game genre.
function genreDefaults(genre: string | null): ArchitectState {
  const base = initialState();
  const enable = (ids: string[]) => {
    for (const id of Object.keys(base)) base[id].enabled = ids.includes(id);
  };
  switch (genre) {
    case "rpg":
      enable(["health", "stamina", "magic", "inventory", "combat", "dialogue"]);
      break;
    case "shooter":
      enable(["health", "stamina", "inventory", "combat"]);
      break;
    case "platformer":
      enable(["health", "stamina"]);
      break;
    case "puzzle":
      enable(["inventory"]);
      break;
    case "card":
      enable(["health", "magic"]);
      break;
    case "social":
      enable(["inventory", "dialogue"]);
      break;
    case "survival":
      enable(["health", "stamina", "inventory", "combat"]);
      break;
    case "racing":
      enable(["stamina"]);
      break;
    case "strategy":
      enable(["combat", "inventory"]);
      break;
    case "horror":
      enable(["health", "stamina", "inventory"]);
      break;
    case "sandbox":
      enable(["health", "stamina", "inventory", "combat"]);
      break;
    case "fighting":
      enable(["health", "stamina", "combat"]);
      break;
  }
  return base;
}

// ---------- component ----------

function SystemArchitect() {
  const { focus } = Route.useSearch();
  const navigate = useNavigate();
  const { gameType, architect } = useGameStore();

  const [state, setState] = useState<ArchitectState>(
    () => architect ?? genreDefaults(gameType.genre),
  );
  const [activeId, setActiveId] = useState<string>(focus ?? "health");
  const [copied, setCopied] = useState(false);

  // Persist on every change
  useEffect(() => {
    setArchitect(state);
  }, [state]);

  // Honor incoming ?focus= search param
  useEffect(() => {
    if (focus && SYSTEMS.some((s) => s.id === focus)) setActiveId(focus);
  }, [focus]);

  const activeSystem = SYSTEMS.find((s) => s.id === activeId)!;
  const activeState = state[activeId];

  const toggle = (id: string) =>
    setState((prev) => ({ ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }));

  const setValue = (key: string, value: string | string[] | number) =>
    setState((prev) => ({
      ...prev,
      [activeId]: { ...prev[activeId], values: { ...prev[activeId].values, [key]: value } },
    }));

  const baseAlways = [
    { name: "TransformComponent", note: "Position, rotation, scale" },
    { name: "MovementController", note: "Walk, jump, physics" },
  ];

  const { foundation, extensions, manifest } = useMemo(() => {
    const foundation: { sys: SystemDef; components: string[] }[] = [];
    const extensions: { sys: SystemDef; components: string[]; scopeNote: string }[] = [];

    for (const sys of SYSTEMS) {
      const st = state[sys.id];
      if (!st?.enabled) continue;
      const scope = (st.values["scope"] as Scope) ?? "all";
      if (scope === "all") {
        foundation.push({ sys, components: sys.components });
      } else {
        extensions.push({
          sys,
          components: sys.components,
          scopeNote: scope === "player" ? "Player only" : "Tagged characters",
        });
      }
    }

    const manifest = {
      target: "ai-game-maker",
      game: { dimension: gameType.dimension, genre: gameType.genre },
      baseClass: "BaseCharacter",
      foundation: [
        ...baseAlways.map((b) => b.name),
        ...foundation.flatMap((f) => f.components),
      ],
      extensions: extensions.map((e) => ({
        name: `${e.sys.name}Extension`,
        appliesTo: e.scopeNote,
        components: e.components,
        config: state[e.sys.id].values,
      })),
      foundationConfig: Object.fromEntries(
        foundation.map((f) => [f.sys.id, state[f.sys.id].values]),
      ),
    };

    return { foundation, extensions, manifest };
  }, [state, gameType]);

  const copyManifest = async () => {
    await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const enabledCount = Object.values(state).filter((s) => s.enabled).length;

  const genreLabel = gameType.genre ? gameType.genre.toUpperCase() : "UNSET";
  const dimLabel = gameType.dimension ? gameType.dimension.toUpperCase() : "—";

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="border-b border-zinc-200 bg-zinc-50 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <div className="space-y-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-zinc-400 uppercase hover:text-zinc-900"
            >
              <ArrowLeft className="size-3" /> Change game type
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              System Architect
            </h1>
            <p className="max-w-[60ch] text-sm text-pretty text-zinc-500">
              Building a <span className="font-mono text-zinc-700">{dimLabel}</span>{" "}
              <span className="font-mono text-zinc-700">{genreLabel}</span> game. Decide which systems it has, answer a few questions, then preview the result.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyManifest}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-black/5 transition-colors hover:bg-zinc-100"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy Blueprint"}
            </button>
            <button
              onClick={() => navigate({ to: "/preview" })}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-transform hover:scale-[1.02]"
            >
              Preview <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 space-y-12 lg:col-span-7">
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
                    Component Catalog
                  </h2>
                  <span className="font-mono text-xs text-zinc-400">
                    {enabledCount} / {SYSTEMS.length} enabled
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {SYSTEMS.map((sys) => {
                    const st = state[sys.id];
                    const isActive = sys.id === activeId;
                    const Icon = sys.icon;
                    return (
                      <div
                        key={sys.id}
                        className={`flex items-center justify-between rounded-xl p-4 ring-1 transition-colors ${
                          st.enabled ? "bg-white ring-black/5" : "bg-zinc-100/50 ring-black/5"
                        } ${isActive ? "ring-2 ring-brand" : ""}`}
                      >
                        <button
                          onClick={() => setActiveId(sys.id)}
                          className="flex flex-1 items-center gap-3 text-left"
                        >
                          <div
                            className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                              st.enabled ? "bg-zinc-100" : "bg-zinc-200"
                            }`}
                          >
                            <Icon
                              className={`size-4 ${st.enabled ? "text-zinc-700" : "text-zinc-400"}`}
                            />
                          </div>
                          <div>
                            <div
                              className={`text-sm font-medium ${
                                st.enabled ? "text-zinc-900" : "text-zinc-500"
                              }`}
                            >
                              {sys.name}
                            </div>
                            <div className="text-xs text-zinc-400">{sys.blurb}</div>
                          </div>
                        </button>
                        <button
                          aria-label={`Toggle ${sys.name}`}
                          onClick={() => toggle(sys.id)}
                          className={`relative h-4 w-8 shrink-0 rounded-full transition-colors ${
                            st.enabled ? "bg-brand" : "bg-zinc-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${
                              st.enabled ? "right-0.5" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-8 rounded-2xl bg-white p-8 ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium">{activeSystem.name} Configuration</h3>
                    <p className="max-w-[56ch] text-sm text-zinc-500">
                      {activeState.enabled
                        ? `Define how ${activeSystem.name.toLowerCase()} behaves across your entities.`
                        : `${activeSystem.name} is disabled — enable it above to configure.`}
                    </p>
                  </div>
                  {activeState.enabled && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                      <span className="size-1.5 rounded-full bg-brand" /> Active
                    </span>
                  )}
                </div>

                {activeState.enabled ? (
                  <div className="space-y-7">
                    {activeSystem.questions.map((q) => (
                      <QuestionRow
                        key={q.key}
                        question={q}
                        value={activeState.values[q.key]}
                        onChange={(v) => setValue(q.key, v)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid place-items-center rounded-lg border border-dashed border-zinc-200 py-12 text-sm text-zinc-400">
                    <div className="flex flex-col items-center gap-2">
                      <Eye className="size-5" />
                      <span>Flip the switch on {activeSystem.name} to see its questions.</span>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="col-span-12 lg:col-span-5">
              <div className="sticky top-8 space-y-6">
                <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
                  Live Architecture
                </h2>

                <div className="space-y-4">
                  <div className="rounded-2xl bg-zinc-900 p-6 text-white shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-mono text-xs tracking-widest text-zinc-400 uppercase">
                        Foundation
                      </span>
                      <div className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                        BaseCharacter.class
                      </div>
                    </div>
                    <div className="space-y-2">
                      {baseAlways.map((b) => (
                        <BaseRow key={b.name} name={b.name} note={b.note} />
                      ))}
                      {foundation.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-700/50 p-3 text-xs text-zinc-500">
                          No systems are universal yet. Set a system's scope to "All entities"
                          to add it here.
                        </div>
                      ) : (
                        foundation.flatMap((f) =>
                          f.components.map((c) => (
                            <BaseRow key={c} name={c} note={`${f.sys.name} — shared by all`} />
                          )),
                        )
                      )}
                    </div>
                  </div>

                  {extensions.length > 0 && (
                    <div className="ml-10 h-6 border-l-2 border-dashed border-zinc-300" />
                  )}

                  {extensions.length > 0 && (
                    <div className="ml-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="font-mono text-xs tracking-widest text-zinc-500 uppercase">
                          Extension Modules
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {extensions.length} module{extensions.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {extensions.map((e) => (
                          <div key={e.sys.id} className="rounded-lg bg-zinc-50 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium">{e.sys.name}Extension</div>
                              <span className="font-mono text-[10px] text-zinc-400">
                                {e.scopeNote}
                              </span>
                            </div>
                            <p className="mt-1 max-w-[40ch] text-[11px] text-zinc-500">
                              Inherits BaseCharacter. Adds {e.components.join(", ")}.
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl bg-zinc-100 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-brand" />
                        <span className="text-xs font-medium text-zinc-600">
                          AI Blueprint Manifest
                        </span>
                      </div>
                      <button
                        onClick={copyManifest}
                        className="font-mono text-[10px] text-zinc-500 hover:text-zinc-900"
                      >
                        {copied ? "copied" : "copy"}
                      </button>
                    </div>
                    <pre className="max-h-64 overflow-auto font-mono text-[10px] leading-relaxed text-zinc-600">
{JSON.stringify(manifest, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-zinc-200 py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 text-xs font-medium tracking-tight text-zinc-400 uppercase">
          <div className="flex gap-8">
            <span>Target: AI Game Maker</span>
            <span>Status: Draft</span>
          </div>
          <button
            onClick={() => setState(genreDefaults(gameType.genre))}
            className="transition-colors hover:text-zinc-900"
          >
            Reset
          </button>
        </div>
      </footer>
    </div>
  );
}

// ---------- subcomponents ----------

function BaseRow({ name, note }: { name: string; note: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
      <div className="size-2 rounded-full bg-brand shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      <div className="flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-[11px] text-zinc-500">{note}</div>
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  value,
  onChange,
}: {
  question: QuestionDef;
  value: string | string[] | number;
  onChange: (v: string | string[] | number) => void;
}) {
  if (question.kind === "single") {
    const v = value as string;
    const hasDescriptions = question.options.some((o) => o.description);
    if (hasDescriptions) {
      return (
        <div className="space-y-3">
          <label className="text-sm font-medium text-zinc-700">{question.label}</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {question.options.map((opt) => {
              const active = opt.id === v;
              return (
                <button
                  key={opt.id}
                  onClick={() => onChange(opt.id)}
                  className={`flex items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                    active ? "bg-zinc-50 ring-1 ring-black/5" : "ring-1 ring-zinc-200 hover:bg-zinc-50/50"
                  }`}
                >
                  <div
                    className={`mt-0.5 size-4 shrink-0 rounded-full ${
                      active ? "border-4 border-brand" : "border border-zinc-300"
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    {opt.description && (
                      <div className="text-xs text-zinc-500">{opt.description}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-700">{question.label}</label>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(question.options.length, 4)}, minmax(0, 1fr))` }}
        >
          {question.options.map((opt) => {
            const active = opt.id === v;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                className={`rounded-lg px-4 py-2 text-sm transition-transform ${
                  active
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 ring-1 ring-black/5 hover:bg-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.kind === "multi") {
    const v = value as string[];
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-700">{question.label}</label>
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => {
            const active = v.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() =>
                  onChange(active ? v.filter((x) => x !== opt.id) : [...v, opt.id])
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-brand text-brand-foreground"
                    : "bg-zinc-100 text-zinc-600 ring-1 ring-black/5 hover:bg-zinc-200"
                }`}
              >
                {active && <Check className="size-3" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const v = value as number;
  const pct = ((v - question.min) / (question.max - question.min)) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700">{question.label}</label>
        <span className="font-mono text-xs font-medium text-zinc-500">
          {v} {question.unit}
        </span>
      </div>
      <div className="relative">
        <div className="h-1.5 rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range"
          min={question.min}
          max={question.max}
          step={question.step}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm ring-2 ring-brand"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

void Zap;
