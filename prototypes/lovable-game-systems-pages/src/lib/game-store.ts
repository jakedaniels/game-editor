import { useSyncExternalStore } from "react";

export type GameType = {
  dimension: "2d" | "3d" | null;
  genre: string | null;
};

export type ArchitectState = Record<
  string,
  { enabled: boolean; values: Record<string, string | string[] | number> }
>;

export type HudPos = { x: number; y: number }; // percentages 0..100 of stage
export type HudLayout = Record<string, HudPos>;

type Store = {
  gameType: GameType;
  architect: ArchitectState | null;
  hudLayout: HudLayout;
};

const KEY = "game-architect-store-v2";
const DEFAULT: Store = {
  gameType: { dimension: null, genre: null },
  architect: null,
  hudLayout: {
    health: { x: 3, y: 4 },
    magic: { x: 3, y: 22 },
    stamina: { x: 3, y: 40 },
    inventory: { x: 75, y: 4 },
    combat: { x: 3, y: 82 },
    dialogue: { x: 25, y: 80 },
  },
};

let state: Store = load();
const listeners = new Set<() => void>();

function load(): Store {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function emit() {
  for (const l of listeners) l();
}

export function setGameType(next: Partial<GameType>) {
  state = { ...state, gameType: { ...state.gameType, ...next } };
  persist();
  emit();
}

export function setArchitect(next: ArchitectState) {
  state = { ...state, architect: next };
  persist();
  emit();
}

export function setHudPos(id: string, pos: HudPos) {
  state = { ...state, hudLayout: { ...state.hudLayout, [id]: pos } };
  persist();
  emit();
}

export function resetHudLayout() {
  state = { ...state, hudLayout: DEFAULT.hudLayout };
  persist();
  emit();
}

export function resetAll() {
  state = DEFAULT;
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useGameStore(): Store {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DEFAULT,
  );
}
