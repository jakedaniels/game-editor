# gameblueprint/0.1 — export schema contract

The unified project export served by `GET /api/projects/{id}/export`. This is the document
the **MCP server** wraps (each read tool serves a slice of it) and the reference for anyone
consuming platform data. Built by `backend/api/services/blueprint.py` — change both together,
and bump `format` on any breaking change.

For the platformer demo, the MCP server can either call the export endpoint once and slice
it, or hit the underlying REST endpoints per tool (`/api/projects/{id}`, `/api/levels`,
`/api/entities?project_id=`, `/api/scenes/{id}/dialogues`) — the export is the same data
assembled canonically, so prefer wrapping the export.

## Top level

```jsonc
{
  "format": "gameblueprint/0.1",
  "project": { "id": 3, "name": "Sim Test", "dimension": "2d", "genre": "platformer" },
  "systems": { /* per-system config + derived feel numbers, see below */ },
  "state_schema": { /* project-wide state variables used by dialogue requirements/effects */ },
  "characters": [ /* speaking characters, portraits, relationships */ ],
  "entity_types": [ /* the level palette: enemies/hazards/pickups/props */ ],
  "tile_legend": { /* glyph -> meaning, built-ins + entities merged */ },
  "levels": [ /* ordered; layout grids, entity coords, transitions, dialogue */ ]
}
```

## systems

Key = system id (`health`, `stamina`, `movement`, `magic`, `inventory`, `combat`,
`dialogue`). The question set is defined in `frontend/src/lib/gameSystems.ts`; only the
*answers* are stored/exported.

```jsonc
"movement": {
  "enabled": true,
  "values": { "scope": "all", "jumpHeight": 3, "gravity": 100, "runSpeed": 8 },
  "derived": {                       // present for health / movement / stamina
    "gravity_units_per_s2": 25.0,    // 1 "unit" = 1 grid cell of the level layout
    "jump_velocity_units_per_s": 12.25,
    "hang_time_s": 0.98,
    "run_speed_units_per_s": 8.0,
    "jump_height_units": 3.0,
    "takeaway": "Jumps 3 units high · ~1.0s of hang time"
  }
}
```

`derived` carries the same numbers that drive the platform's Systems-tab simulations
(`backend/api/services/derived.py`, ported from `frontend/src/lib/systemSimMath.ts`).
**Implementations should honor these numbers** — they are the designer's tuned "feel".
`takeaway` strings are plain-language design intent; surface them to the agent.

Health derived: `{ "damage_per_hit": 20.0, "hits_to_die": 8, "takeaway": "..." }` —
`hits_to_die` accounts for the regen mode (`values.regen`: `auto|pickup|rest|never`).

## entity_types

```jsonc
{
  "id": 1, "name": "Walker", "glyph": "e", "category": "enemy",   // enemy|hazard|pickup|prop
  "description": "A basic patrolling enemy. Turns around at edges and walls.",
  "behavior": {
    "pattern": "patrol",        // static | walk | patrol | fly
    "speed": 3,                 // units/sec (grid cells per second)
    "harmful_on_touch": true,
    "stompable": true           // Mario-style: jumping on top defeats it
  },
  "image_url": "https://…"      // presigned S3 URL, short-lived; "" if no image
}
```

`behavior` is a bounded vocabulary on purpose — implement exactly these semantics; free-form
nuance lives in `description`.

## levels + layout

Levels are ordered (`order`); completing one advances to `on_complete.next_level_id`
(`null` = game over/end). `intro_scene_id` names the dialogue scene to play at level start.

```jsonc
{
  "id": 2, "name": "Level 1", "order": 0,
  "layout": {
    "width": 20, "height": 6,
    "rows": [
      "....................",
      "..........o.........",
      ".....===............",
      "P........e.....^..G.",
      "####################",
      "####################"
    ]
  },
  "entities": [ /* coordinate list derived from rows, see below */ ],
  "intro_scene_id": 6,
  "on_complete": { "next_level_id": 3 },
  "scenes": [ /* dialogue scenes incl. the intro, see below */ ]
}
```

**Grid semantics.** One cell = one game unit (the same "unit" as movement's
`jump_height_units` — a 3-unit jump clears a 3-cell wall). `(x=0, y=0)` is the **top-left**
cell; `x` grows rightward, `y` grows **downward** (row index). `layout` is `null` when the
designer hasn't drawn the level yet.

**Built-in glyphs** (fixed meaning in every project):

| glyph | meaning |
|-------|---------|
| `.` | empty space |
| `#` | solid ground (collidable from all sides) |
| `=` | one-way platform (collidable from above only) |
| `P` | player start position |
| `G` | goal — touching it completes the level |

Every other glyph is an `entity_types[].glyph`. `tile_legend` merges both for convenience.

**`entities`** is the same information as the rows, pre-flattened into coordinates —
use whichever form is easier:

```jsonc
[
  { "glyph": "P", "builtin": true, "x": 0, "y": 3 },
  { "glyph": "e", "entity_type_id": 1, "x": 9, "y": 3 },
  { "glyph": "G", "builtin": true, "x": 18, "y": 3 }
]
```

(`"unknown": true` marks a glyph with no matching entity type — the API rejects these on
save, so it only appears in legacy/hand-seeded data. Treat as empty.)

## characters

```jsonc
{
  "id": 5, "name": "Elara", "description": "…", "image_url": "https://… or ''",
  "relationships": [ { "to_character_id": 7, "to_name": "Bram", "relationship": "mentor of" } ]
}
```

Relationships are directed edges (from this character to `to_character_id`).

## scenes + dialogue graphs

Each level's `scenes[]` carries its full dialogue graph — a **graph**, not a tree (nodes can
be reached from multiple parents; loops are legal). `is_intro` marks the level's intro scene.

```jsonc
{
  "id": 6, "name": "Opening", "order": 0, "is_intro": true,
  "dialogue": {
    "nodes": [
      {
        "id": 41, "title": "opening_1",          // stable Yarn-friendly identifier
        "speaker": "Elara", "character_id": 5,
        "text": "The bridge is out. You'll have to jump.",
        "requirements": [],                       // gate: show only if all pass
        "effects": [],                            // apply when this node plays
        "is_root": true                           // entry point (no incoming edges)
      }
    ],
    "edges": [
      { "from": 41, "to": 42, "option_label": "Ask about the bridge", "order": 0 }
    ]
  }
}
```

- Play a scene by starting at its root node(s), showing outgoing edges as the player's
  choices; `option_label` falls back to the target node's `text` when blank.
- `requirements` / `effects` use the bounded vocabulary (types:
  `has_item | stat_check | state_equals | remembered_choice` and
  `give_item | remove_item | change_stat | set_flag | remember_choice`), each a dict with
  a `type` plus its parameters; `state_schema` declares the variables they reference.
  The same graphs are exportable as Yarn via `GET /api/scenes/{id}/export-yarn`.

## Suggested MCP tool mapping (for the server implementation)

| tool | serves |
|------|--------|
| `get_blueprint()` | the whole document (small games) |
| `get_game_config()` | `project` + `systems` (+ derived) + `state_schema` |
| `list_levels()` / `get_level(id)` | `levels[]` entry incl. layout + entities |
| `get_dialogue_scene(id)` | one `scenes[]` entry with its graph |
| `list_entity_types()` | `entity_types` + `tile_legend` |
| `get_character(id)` | one `characters[]` entry |

All REST endpoints are unauthenticated localhost for the prototype (`http://localhost:8000`);
image URLs are short-lived presigned GETs — fetch them promptly, don't store them.
