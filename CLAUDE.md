# CLAUDE.md

Project context for Claude Code. Read this before making changes.

## What this is

`game-editor` is an early-stage **Figma-like design platform**. It has two pages: a **shape
editor** (create/move SVG shape outlines) and a **branching dialogue editor** (navigate a tree
of dialogue nodes). It is intentionally minimal — favor small, readable additions over large
abstractions until the feature set grows.

## Architecture

Polyglot monorepo. The frontend is an npm workspace; the backend is a Python/Django project.

```
frontend/   React 19 + TypeScript 6 + Vite 8 (npm). SVG-based shape rendering.
backend/    Django 5.2 + Django Ninja (Python 3.11, venv). Server for heavier tasks.
            Postgres 14 is the database (local: db `game_editor`, role `game_editor`).
```

Toolchain: Node 24 (LTS), npm 11 (frontend); Python 3.11 + `backend/.venv` (backend).
`frontend/src/vite-env.d.ts` (`/// <reference types="vite/client" />`) provides the ambient
module declarations for CSS/asset imports — keep it.

### Frontend (`frontend/`)
- Entry: `src/main.tsx` wraps `<App>` in `<BrowserRouter>` (react-router). `src/App.tsx` is the
  shell: a top nav + `<Routes>` → `/` = `pages/ShapeEditorPage`, `/dialogue` = `pages/DialogueEditorPage`.
- **Theming**: the palette is CSS variables under `[data-theme='neon'|'aqua'|'light']` in
  `App.css`; `App.tsx` sets `document.documentElement.dataset.theme` and persists the choice via
  `PATCH /api/user`. Accent shades use `color-mix(... var(--orange)/var(--green) ...)` so all
  themes stay consistent — **don't hardcode accent `rgba()`** in component CSS.
- **Typed API client**: `src/api/client.ts` is an `openapi-fetch` client typed by
  `src/api/schema.d.ts`, which is **generated** from the backend's OpenAPI spec via
  `npm run gen:api` (backend must be running). Don't hand-edit `schema.d.ts`; regenerate it.
  Re-export backend schemas as TS types from `client.ts` (e.g. `DialogueDetail`, `Scene`).
- **Shape editor** (`pages/ShapeEditorPage.tsx`): holds `shapes`/`tool` in `useState`.
  `src/types.ts` defines the `Shape` model (reuse it). `components/{Toolbar,Canvas,Shape}.tsx`
  render the SVG canvas (create via click-drag with a shape tool, move via the select tool).
- **Dialogue editor** (`pages/DialogueEditorPage.tsx`): **scoped to a scene**. Owns `sceneId` +
  `currentId`; selecting a scene loads that scene's root via `GET /api/dialogues?scene_id=`, then
  `GET /api/dialogues/{id}` for the focused node. Components in `components/dialogue/`:
  `ScenesSidebar` (left, controlled — switches the active scene), `CharactersSidebar` (right),
  `DialogueBlob` (current node + Edit), `ResponseWheel` (horizontal child cards; click →
  `currentId`), `DialogueForm` (shared add/edit). "Back to parent" uses `detail.parent_id`;
  Add/Edit call `POST`/`PATCH /api/dialogues` (new nodes inherit the current `sceneId`).

### Backend (`backend/`) — Django + Django Ninja
- `config/` — Django project: `settings.py` (env-driven via `.env`, see `.env.example`),
  `urls.py` (mounts admin at `/admin/` and the Ninja API at `/api/`), `wsgi.py`/`asgi.py`.
- `api/` — the Django Ninja app. `api/api.py` defines the `NinjaAPI` instance and endpoints.
  - `POST /api/auth` — placeholder that always returns **HTTP 400**. Deliberate stub, not called
    by the frontend. Don't wire it up or change its status without a reason.
  - Endpoints used by the dialogue editor: `GET /api/characters`, `GET /api/scenes`,
    `GET /api/dialogues?scene_id=` (a scene's roots), `GET /api/dialogues/{id}` (node + its
    `responses`), `POST /api/dialogues` (create; `scene_id`/`parent_id`/`character_id`/`text`),
    `PATCH /api/dialogues/{id}` (partial update of `text`/`character_id`).
  - `GET /api/user` / `PATCH /api/user` — the **current user**. No real auth yet, so this is a
    single default user (created on first access via `_current_user()`); it stores per-user
    settings like the UI `theme`.
  - Interactive API docs (Swagger UI) at `/api/docs`; OpenAPI at `/api/openapi.json` (drives the
    frontend's `gen:api`).
- `api/models.py`: `Level → Scene` (FK), `Scene ↔ Character` (M2M), and `Dialogue` — a
  self-referential branching node (`scene` FK, `parent` FK to self, `character` FK, `text`).
  A dialogue's children are `dialogue.responses`; a scene's tree is its `parent=None` roots.
  `User` holds per-user settings (currently `theme`); no auth yet, so a single default user.
- Database: Postgres via `DATABASES['default']` (psycopg 3), params from `POSTGRES_*` env vars
  (defaults target the local `game_editor` db/role). Migrations **are** applied; seed demo
  dialogue data with `python manage.py seed_dialogue`.
- **CORS is active** (`django-cors-headers`): allowed origins come from `DJANGO_CORS_ORIGINS`
  (defaults to the Vite dev server). Add new origins there.
- Add endpoints on the `api` object in `api/api.py`; use Ninja `Schema` classes for I/O. After
  changing a schema, regenerate the frontend types (`npm run gen:api`).

## Conventions

- **Frontend: TypeScript everywhere.** Keep components small and single-purpose.
- **Backend: Python/Django.** Keep API logic in `api/`; use Django Ninja `Schema`s for I/O.
  Settings are env-driven — add new config as `os.getenv(...)` with a sane local default and
  document it in `.env.example`.
- **Shapes are outlines:** render with `fill="none"` and a visible `stroke`.
- Coordinates/sizes live on the `Shape` model (`x`, `y`, `width`, `height`); keep geometry math
  in the canvas/shape layer.
- **Frontend↔backend is typed end-to-end**: change a Ninja schema → run `npm run gen:api` →
  consume the regenerated types via `src/api/client.ts`. Don't hand-write API response types.
- The root `.npmrc` sets `legacy-peer-deps=true` because `openapi-typescript@7` still declares a
  `typescript@^5` peer while we're on TS 6 (works fine). Keep it until that peer range updates.

## Common commands

```bash
# Frontend (from repo root)
npm install            # install frontend workspace
npm run dev            # frontend + backend together (concurrently)
npm run dev:web        # frontend only (http://localhost:5173)
npm run build          # build frontend
npm run gen:api -w frontend   # regenerate src/api/schema.d.ts from the API (backend must be up)

# Backend (from backend/, venv at backend/.venv)
./.venv/bin/python manage.py runserver        # serve on :8000  (== npm run dev:api)
./.venv/bin/python manage.py makemigrations api && ./.venv/bin/python manage.py migrate
./.venv/bin/python manage.py seed_dialogue    # seed demo dialogue tree
./.venv/bin/pip install -r requirements.txt   # (re)install backend deps
```

Postgres runs as a Homebrew service: `brew services start|stop postgresql@14`.

## Data models

Frontend shape model (`frontend/src/types.ts`):
```ts
type ShapeType = 'rectangle' | 'ellipse';
interface Shape { id: string; type: ShapeType; x: number; y: number; width: number; height: number; }
```

Backend dialogue node (`backend/api/models.py`) — basic, to be expanded later:
```python
class Dialogue(models.Model):
    scene = ForeignKey(Scene, null=True, related_name="dialogues")     # which scene's tree
    parent = ForeignKey("self", null=True, related_name="responses")   # None == scene root
    character = ForeignKey(Character, null=True, related_name="dialogues")
    text = TextField(blank=True, default="")
```

## Deliberately out of scope (for now)

Real auth, persistence, multiplayer, resize/rotate handles, zoom/pan, undo/redo. SVG was chosen
for simplicity; migrating to a canvas renderer (e.g. react-konva) is a known future option when
shape counts get large.
