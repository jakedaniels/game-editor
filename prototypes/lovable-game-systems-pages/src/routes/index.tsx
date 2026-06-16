import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Box,
  Square,
  Swords,
  Puzzle,
  Mountain,
  Gamepad2,
  Users,
  Crosshair,
  Sparkles,
  Trees,
  Flag,
  Crown,
  Ghost,
  Hammer,
  Spade,
  ArrowRight,
  Check,
} from "lucide-react";
import { setGameType, useGameStore } from "@/lib/game-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "What kind of game are you making? — Game Architect" },
      {
        name: "description",
        content:
          "Pick a dimension and a genre. We'll surface the right design questions for your game.",
      },
      { property: "og:title", content: "Game Architect" },
      {
        property: "og:description",
        content:
          "Design games by answering questions, not by writing code.",
      },
    ],
  }),
  component: GameTypePicker,
});

type Genre = {
  id: string;
  name: string;
  blurb: string;
  icon: typeof Box;
};

const GENRES: Genre[] = [
  { id: "rpg", name: "RPG", blurb: "Stats, quests, party", icon: Swords },
  { id: "platformer", name: "Platformer", blurb: "Jump, run, precision", icon: Mountain },
  { id: "shooter", name: "Shooter", blurb: "Aim, fire, cover", icon: Crosshair },
  { id: "puzzle", name: "Puzzle", blurb: "Logic and pattern", icon: Puzzle },
  { id: "social", name: "Social Roleplay", blurb: "Hangout, chat, world", icon: Users },
  { id: "card", name: "Card Game", blurb: "Deck, hand, turns", icon: Spade },
  { id: "strategy", name: "Strategy", blurb: "Units, map, plans", icon: Flag },
  { id: "racing", name: "Racing", blurb: "Speed, tracks, drift", icon: Gamepad2 },
  { id: "survival", name: "Survival", blurb: "Gather, craft, endure", icon: Trees },
  { id: "horror", name: "Horror", blurb: "Tension, dread, scarcity", icon: Ghost },
  { id: "sandbox", name: "Sandbox", blurb: "Open systems, freeform", icon: Hammer },
  { id: "fighting", name: "Fighting", blurb: "1v1, combos, frames", icon: Crown },
  { id: "rhythm", name: "Rhythm", blurb: "Beat, timing, music", icon: Sparkles },
];

function GameTypePicker() {
  const navigate = useNavigate();
  const { gameType } = useGameStore();
  const { dimension, genre } = gameType;
  const ready = dimension && genre;

  const onContinue = () => {
    if (!ready) return;
    navigate({ to: "/architect" });
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="border-b border-zinc-200 bg-zinc-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="space-y-2">
            <span className="font-mono text-xs tracking-widest text-zinc-400 uppercase">
              Step 1 of 3
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              What kind of game are you making?
            </h1>
            <p className="max-w-[60ch] text-sm text-pretty text-zinc-500">
              Your answers here decide which design questions show up next — there's no point asking about magic schools for a racing game.
            </p>
          </div>
        </div>
      </header>

      <main className="py-12">
        <div className="mx-auto max-w-6xl space-y-14 px-6">
          {/* Dimension */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
                Dimension
              </h2>
              <span className="font-mono text-xs text-zinc-400">
                {dimension ? dimension.toUpperCase() : "—"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DimCard
                label="2D"
                blurb="Side-scroll, top-down, pixel art, cards, boards"
                icon={Square}
                active={dimension === "2d"}
                onClick={() => setGameType({ dimension: "2d" })}
              />
              <DimCard
                label="3D"
                blurb="First/third person, world space, physics"
                icon={Box}
                active={dimension === "3d"}
                onClick={() => setGameType({ dimension: "3d" })}
              />
            </div>
          </section>

          {/* Genre */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
                Genre
              </h2>
              <span className="font-mono text-xs text-zinc-400">
                {genre ? genre.toUpperCase() : "—"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GENRES.map((g) => {
                const Icon = g.icon;
                const active = genre === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setGameType({ genre: g.id })}
                    className={`flex items-center justify-between rounded-xl p-4 text-left ring-1 transition-colors ${
                      active
                        ? "bg-white ring-2 ring-brand"
                        : "bg-white/60 ring-black/5 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                          active ? "bg-brand/10 text-brand" : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{g.name}</div>
                        <div className="text-xs text-zinc-400">{g.blurb}</div>
                      </div>
                    </div>
                    {active && (
                      <span className="grid size-5 place-items-center rounded-full bg-brand text-brand-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={onContinue}
              disabled={!ready}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              Configure systems <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function DimCard({
  label,
  blurb,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  blurb: string;
  icon: typeof Box;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-xl p-5 text-left ring-1 transition-colors ${
        active ? "bg-white ring-2 ring-brand" : "bg-white/60 ring-black/5 hover:bg-white"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`grid size-12 shrink-0 place-items-center rounded-xl ${
            active ? "bg-brand/10 text-brand" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          <Icon className="size-6" />
        </div>
        <div>
          <div className="text-base font-semibold">{label}</div>
          <div className="text-xs text-zinc-500">{blurb}</div>
        </div>
      </div>
      {active && (
        <span className="grid size-5 place-items-center rounded-full bg-brand text-brand-foreground">
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}
