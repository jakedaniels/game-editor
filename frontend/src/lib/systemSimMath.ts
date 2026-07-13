/**
 * Derived models for the Systems-tab micro-simulations.
 *
 * Pure TS, render-free: each `derive*Model` turns a system's raw answer values into the
 * numbers its vignette animates *and* the plain-language takeaway sentence shown under it,
 * so the animation and the words can never disagree. Sim components map model + loop time
 * to coordinates only — no arithmetic on answer values happens outside this module.
 */

export type SimValues = Record<string, string | string[] | number>;

/** A point on a precomputed looping timeline (time in seconds from loop start). */
export type Keyframe = {
  time: number;
  value: number;
  /** What just happened at this frame (drives per-event visuals like bops/casts). */
  event?: string;
};

// ---------- Shared constants ----------

export const POOL = 100; // canonical resource pool every sim depletes/refills

// Health / combat
export const HIT_BEAT_S = 1.1; // seconds between enemy hits
export const AUTO_REGEN_FRACTION = 0.4; // auto-regen recovers this fraction of a hit between hits
export const PICKUP_HEAL = 25; // a dropped heart restores this much
export const PICKUP_EVERY_N_HITS = 3;
export const DEATH_HOLD_S = 1.6; // how long the death pose lingers before the loop resets

// Stamina
export const DRAIN_COSTS: Record<string, { kind: 'continuous' | 'burst'; amount: number; duration: number; label: string }> = {
  sprint: { kind: 'continuous', amount: 25, duration: 1.2, label: 'Sprint' }, // amount = per second
  jump: { kind: 'burst', amount: 15, duration: 0.5, label: 'Jump' },
  attack: { kind: 'burst', amount: 12, duration: 0.5, label: 'Attack' },
  block: { kind: 'continuous', amount: 10, duration: 1.0, label: 'Block' },
};
export const STAMINA_FLOOR = 10; // the loop stops draining here and switches to recovery

// Magic
export const SPELLS: Record<string, { cost: number; cooldown: number; label: string }> = {
  fire: { cost: 25, cooldown: 4, label: 'Fire' },
  frost: { cost: 20, cooldown: 3, label: 'Frost' },
  nature: { cost: 15, cooldown: 2.5, label: 'Nature' },
  arcane: { cost: 30, cooldown: 6, label: 'Arcane' },
  shadow: { cost: 22, cooldown: 5, label: 'Shadow' },
};
export const CAST_BEAT_S = 0.9;
export const CHARGES_PER_SCHOOL = 3;

// Inventory
export const PICKUPS_PER_SECOND = 3;
export const WEIGHT_CHUNKS = [2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 2]; // deterministic mixed weights

// Movement (an abstract "unit" is the game's own distance unit)
export const EARTH_GRAVITY_UNITS = 25; // units/sec² at gravity = 100%

// ---------- Helpers ----------

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Linear interpolation over a keyframe list; staircase when `step` is true. */
export function sampleTimeline(frames: Keyframe[], time: number, step = false): number {
  if (frames.length === 0) return 0;
  if (time <= frames[0].time) return frames[0].value;
  for (let i = 1; i < frames.length; i++) {
    if (time <= frames[i].time) {
      if (step) return frames[i - 1].value;
      const a = frames[i - 1];
      const b = frames[i];
      const f = b.time === a.time ? 1 : (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * f;
    }
  }
  return frames[frames.length - 1].value;
}

// ---------- Health ----------

export type HealthModel = {
  damagePerHit: number;
  hitsToDie: number; // effective, accounting for regen mode
  regen: string;
  display: string;
  periodSeconds: number;
  /** HP over one loop: bop drops + regen recovery + death hold + reset. */
  frames: Keyframe[];
  takeaway: string;
};

export function deriveHealthModel(values: SimValues): HealthModel {
  const lethality = clamp(num(values.lethality, 65), 5, 100);
  const regen = str(values.regen, 'auto');
  const display = str(values.display, 'hearts');

  const frames: Keyframe[] = [{ time: 0, value: POOL }];
  let hp = POOL;
  let t = 0;
  let hits = 0;
  // Simulate bops until death (capped so lethality 5 + heals can't loop forever on screen).
  while (hp > 0 && hits < 24) {
    t += HIT_BEAT_S;
    frames.push({ time: t - 0.02, value: hp }); // hold, so the drop renders as a sharp step
    hp = Math.max(0, hp - lethality);
    hits += 1;
    frames.push({ time: t, value: hp, event: 'bop' });
    if (hp <= 0) break;
    if (regen === 'auto') {
      const healed = Math.min(POOL, hp + lethality * AUTO_REGEN_FRACTION);
      frames.push({ time: t + HIT_BEAT_S * 0.9, value: healed });
      hp = healed;
    } else if (regen === 'pickup' && hits % PICKUP_EVERY_N_HITS === 0) {
      const healed = Math.min(POOL, hp + PICKUP_HEAL);
      frames.push({ time: t + HIT_BEAT_S * 0.45, value: hp });
      frames.push({ time: t + HIT_BEAT_S * 0.5, value: healed, event: 'pickup' });
      hp = healed;
    }
  }
  const died = hp <= 0;
  if (died) frames.push({ time: t + DEATH_HOLD_S, value: 0, event: 'reset' });
  const periodSeconds = frames[frames.length - 1].time + (died ? 0.4 : HIT_BEAT_S);

  const regenClause: Record<string, string> = {
    auto: ' — but breathing room heals the damage',
    pickup: ' — unless they find a pickup',
    rest: ' — damage sticks until the next rest',
    never: ' — and every scratch is permanent',
  };
  const takeaway = died
    ? `A careless player dies in ~${hits} hit${hits === 1 ? '' : 's'}${regenClause[regen] ?? ''}`
    : 'Damage wears the player down, but recovery outpaces it — a single fight can’t kill';

  return { damagePerHit: lethality, hitsToDie: hits, regen, display, periodSeconds, frames, takeaway };
}

// ---------- Movement ----------

export type MovementModel = {
  jumpHeight: number; // units
  gravityUnits: number; // units/sec²
  runSpeed: number; // units/sec
  jumpVelocity: number; // units/sec
  hangTime: number; // seconds
  takeaway: string;
};

export function deriveMovementModel(values: SimValues): MovementModel {
  const jumpHeight = clamp(num(values.jumpHeight, 3), 1, 10);
  const gravityPct = clamp(num(values.gravity, 100), 10, 200);
  const runSpeed = clamp(num(values.runSpeed, 8), 1, 20);
  const gravityUnits = EARTH_GRAVITY_UNITS * (gravityPct / 100);
  const jumpVelocity = Math.sqrt(2 * gravityUnits * jumpHeight);
  const hangTime = (2 * jumpVelocity) / gravityUnits;
  const feel = hangTime >= 1.6 ? ' — moon-bounce floaty' : hangTime <= 0.6 ? ' — snappy and heavy' : '';
  return {
    jumpHeight,
    gravityUnits,
    runSpeed,
    jumpVelocity,
    hangTime,
    takeaway: `Jumps ${jumpHeight} unit${jumpHeight === 1 ? '' : 's'} high · ~${hangTime.toFixed(1)}s of hang time${feel}`,
  };
}

// ---------- Stamina ----------

export type StaminaModel = {
  drains: string[];
  regenRate: number;
  periodSeconds: number;
  frames: Keyframe[]; // stamina over one loop; events name the draining action
  takeaway: string;
};

export function deriveStaminaModel(values: SimValues): StaminaModel {
  const drains = arr(values.drains).filter((d) => d in DRAIN_COSTS);
  const regenRate = clamp(num(values.regenRate, 12), 1, 50);

  const frames: Keyframe[] = [{ time: 0, value: POOL }];
  let stamina = POOL;
  let t = 0;
  if (drains.length > 0) {
    // Cycle through the selected drains until the bar hits the floor.
    let guard = 0;
    outer: while (guard++ < 20) {
      for (const id of drains) {
        const d = DRAIN_COSTS[id];
        const cost = d.kind === 'continuous' ? d.amount * d.duration : d.amount;
        t += d.duration;
        stamina = Math.max(0, stamina - cost);
        frames.push({ time: t, value: stamina, event: id });
        if (stamina <= STAMINA_FLOOR) break outer;
      }
    }
    // Recovery: pant back to full at regenRate.
    const refill = (POOL - stamina) / regenRate;
    t += refill;
    frames.push({ time: t, value: POOL, event: 'rest' });
  }
  const periodSeconds = drains.length > 0 ? t + 0.6 : 1;

  const bits = [`Empty to full in ~${Math.ceil(POOL / regenRate)}s of rest`];
  if (drains.includes('jump')) bits.push(`chain ~${Math.floor(POOL / DRAIN_COSTS.jump.amount)} jumps before gasping`);
  if (drains.includes('sprint')) bits.push(`~${(POOL / DRAIN_COSTS.sprint.amount).toFixed(1)}s of full sprint`);
  const takeaway = drains.length === 0 ? 'Nothing drains stamina yet — select a drain above' : bits.join(' · ');

  return { drains, regenRate, periodSeconds, frames, takeaway };
}

// ---------- Magic ----------

export type MagicModel = {
  resource: string;
  schools: { id: string; cost: number; cooldown: number; label: string }[];
  periodSeconds: number;
  /** mana/charges over one loop (unused for the cooldown model). */
  frames: Keyframe[];
  castsPerPool: number;
  totalCharges: number;
  maxCooldown: number;
  takeaway: string;
};

export function deriveMagicModel(values: SimValues): MagicModel {
  const resource = str(values.resource, 'mana');
  const schools = arr(values.schools)
    .filter((s) => s in SPELLS)
    .map((id) => ({ id, ...SPELLS[id] }));

  const frames: Keyframe[] = [{ time: 0, value: POOL }];
  let periodSeconds = 1;
  let castsPerPool = 0;
  const totalCharges = schools.length * CHARGES_PER_SCHOOL;
  const maxCooldown = schools.reduce((m, s) => Math.max(m, s.cooldown), 0);

  if (schools.length > 0) {
    if (resource === 'mana') {
      let mana = POOL;
      let t = 0;
      let i = 0;
      while (mana >= schools[i % schools.length].cost) {
        const spell = schools[i % schools.length];
        t += CAST_BEAT_S;
        frames.push({ time: t - 0.02, value: mana });
        mana -= spell.cost;
        castsPerPool += 1;
        frames.push({ time: t, value: mana, event: spell.id });
        i += 1;
      }
      frames.push({ time: t + 0.6, value: mana, event: 'dry' }); // fizzle flash
      frames.push({ time: t + 2.1, value: POOL, event: 'refill' });
      periodSeconds = t + 2.6;
    } else if (resource === 'charges') {
      let t = 0;
      for (let c = totalCharges; c > 0; c--) {
        t += 0.7;
        frames.push({ time: t, value: c - 1, event: schools[(totalCharges - c) % schools.length].id });
      }
      frames[0].value = totalCharges;
      frames.push({ time: t + 1.4, value: totalCharges, event: 'reset' }); // encounter reset sweep
      periodSeconds = t + 1.8;
    } else {
      periodSeconds = maxCooldown; // cooldown dials each sweep on their own timer
    }
  }

  const avgCost = schools.length ? schools.reduce((s, x) => s + x.cost, 0) / schools.length : 0;
  const takeaway =
    schools.length === 0
      ? 'Pick at least one school to see casting'
      : resource === 'mana'
        ? `A full pool covers ~${Math.floor(POOL / avgCost)} casts before running dry`
        : resource === 'cooldown'
          ? `Every spell is back up within ${maxCooldown}s — spam is limited by timers, not a pool`
          : `${totalCharges} total casts per encounter, then you’re out`;

  return { resource, schools, periodSeconds, frames, castsPerPool, totalCharges, maxCooldown, takeaway };
}

// ---------- Inventory ----------

export type InventoryModel = {
  capacityModel: string;
  slots: number;
  /** For weight mode: cumulative weight after each item, last entry overloads. */
  weights: number[];
  estItems: number;
  periodSeconds: number;
  takeaway: string;
};

export function deriveInventoryModel(values: SimValues): InventoryModel {
  const capacityModel = str(values.capacity, 'slots');
  const slots = clamp(num(values.slots, 12), 4, 64);

  let weights: number[] = [];
  let estItems = slots;
  let periodSeconds = slots / PICKUPS_PER_SECOND + 1.6; // fill + FULL flash + clear
  let takeaway = `Players juggle ${slots} slots — full after ${slots} pickups (~${Math.ceil(slots / PICKUPS_PER_SECOND)}s of greedy looting)`;

  if (capacityModel === 'weight') {
    let total = 0;
    let i = 0;
    weights = [];
    while (total < slots) {
      total += WEIGHT_CHUNKS[i % WEIGHT_CHUNKS.length];
      weights.push(total);
      i += 1;
    }
    estItems = Math.max(1, weights.length - 1); // last chunk overloads
    periodSeconds = weights.length / PICKUPS_PER_SECOND + 1.6;
    takeaway = `Carries ~${estItems} items of mixed weight before overloading (budget: ${slots})`;
  } else if (capacityModel === 'unlimited') {
    periodSeconds = 4;
    takeaway = 'Hoarders welcome — nothing is ever left behind';
  }

  return { capacityModel, slots, weights, estItems, periodSeconds, takeaway };
}

// ---------- Combat ----------

export const COMBAT_MODES: Record<string, { beat: number; label: string }> = {
  melee: { beat: 0.9, label: 'Melee' },
  ranged: { beat: 1.3, label: 'Ranged' },
  magic: { beat: 1.8, label: 'Magical' },
};

export type CombatModel = {
  modes: string[];
  health: HealthModel; // knight HP reuses the health system's model
  healthFallback: boolean; // true when the health system is disabled
  periodSeconds: number;
  takeaway: string;
};

export function deriveCombatModel(values: SimValues, healthValues: SimValues | undefined): CombatModel {
  const modes = arr(values.modes).filter((m) => m in COMBAT_MODES);
  const health = deriveHealthModel(healthValues ?? {});
  const modeList = modes.map((m) => COMBAT_MODES[m].label).join(' + ');
  const takeaway =
    modes.length === 0
      ? 'Select a combat mode to start the skirmish'
      : `${modeList} skirmish: the player trades ~${health.hitsToDie} hits before falling`;
  return { modes, health, healthFallback: healthValues === undefined, periodSeconds: health.periodSeconds, takeaway };
}

// ---------- Dialogue ----------

export type DialogueModel = { branching: string; takeaway: string };

export function deriveDialogueModel(values: SimValues): DialogueModel {
  const branching = str(values.branching, 'choice');
  const takeaway =
    branching === 'linear'
      ? 'Conversations play straight through'
      : branching === 'tree'
        ? 'Branches remember state and reconverge'
        : 'The player picks each reply';
  return { branching, takeaway };
}
