# CLAUDE.md

Project context for Claude Code. Read this before making changes.

## What this is

`game-editor` is an early-stage **Figma-like design platform** for building games. The top level is
a **Project** (a game), which has tabs: **Settings** (2D/3D + genre), **Systems** (a game-system
architect — health, magic, inventory, … with per-system questions, producing an "ai-game-maker"
blueprint), **Preview** (a draggable retro HUD layout), and **Levels** (each Level has a
**branching dialogue editor**). A standalone **shape editor** (SVG outlines) also exists (route
kept, no nav). It is intentionally minimal — favor small, readable additions over large
abstractions until the feature set grows.

The Systems/Settings/Preview tabs were consolidated from the `prototypes/lovable-game-systems-pages/`
Lovable prototype (a different stack — TanStack/Tailwind/shadcn); their data + logic were **ported**
into our Vite/plain-CSS/typed-Ninja conventions (`src/lib/gameSystems.ts`). The prototype dir is
kept for reference.

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
  shell: top nav + `<Routes>`. **Projects are the top level**: `/` = `ProjectsPage` (list with
  add + inline rename). Clicking a project opens `/projects/:projectId` = `ProjectHomePage`, a
  **layout route with a tab bar** (Settings · Systems · Levels · Characters · Preview) that
  renders an `<Outlet/>`; the index redirects to `settings`. Tab child routes:
  `settings` = `ProjectSettingsPage` (dimension + genre), `systems` = `ProjectSystemsPage`
  (game-system architect + blueprint), `preview` = `ProjectPreviewPage` (draggable retro HUD),
  `levels` = `LevelsPage` (project-scoped list), `characters` = `CharactersPage`. Drilling into a
  level is a **full page outside the tab layout**: `/projects/:projectId/levels/:levelId` =
  `LevelHomePage`, `/projects/:projectId/levels/:levelId/dialogue` = `DialogueEditorPage`. Also
  `/characters` = `CharactersPage` (global) and `/shapes` = `ShapeEditorPage` (route kept; no nav).
- `ProjectHomePage` fetches the project and passes `{ project, patchProject }` to its tabs via
  **`useOutletContext`** (`useProject()` helper). `patchProject(partial)` does an optimistic
  `PATCH /api/projects/{id}`; the Systems/Preview tabs keep a local working copy and **debounce**
  saves (~400ms) so dragging/sliding doesn't flood the API.
- **Game-system definitions** live in `src/lib/gameSystems.ts` (ported from the Lovable
  prototype): `DIMENSIONS`, `GENRES`, `SYSTEMS` (each with `single|multi|slider` questions),
  `genreDefaults()`, `buildManifest()`, plus `normalizeSystems()`/`normalizeHudLayout()` that
  coerce the project's JSON fields into well-formed typed state. **This module is the source of
  truth for the question set** — the DB only stores the *answers*. Edit questions here, not in the
  DB.
- **Theming**: the palette is CSS variables under `[data-theme='neon'|'aqua'|'light'|'studio']` in
  `App.css` (`studio` is the clean teal/light look ported from the prototype); `App.tsx` sets
  `document.documentElement.dataset.theme` and persists the choice via `PATCH /api/user`. Accent
  shades use `color-mix(... var(--orange)/var(--green) ...)` so all themes stay consistent —
  **don't hardcode accent `rgba()`** in component CSS. Adding a theme = add a `[data-theme=...]`
  block + append the name to `User.THEME_CHOICES` (backend) and `THEMES`/`THEME_LABELS` (frontend).
- **Typed API client**: `src/api/client.ts` is an `openapi-fetch` client typed by
  `src/api/schema.d.ts`, which is **generated** from the backend's OpenAPI spec via
  `npm run gen:api` (backend must be running). Don't hand-edit `schema.d.ts`; regenerate it.
  Re-export backend schemas as TS types from `client.ts` (e.g. `Project`, `DialogueDetail`, `Scene`).
- **Shape editor** (`pages/ShapeEditorPage.tsx`): holds `shapes`/`tool` in `useState`.
  `src/types.ts` defines the `Shape` model (reuse it). `components/{Toolbar,Canvas,Shape}.tsx`
  render the SVG canvas (create via click-drag with a shape tool, move via the select tool).
- **Dialogue editor** (`pages/DialogueEditorPage.tsx`): reached via a project's Levels tab → a
  level; reads `projectId`/`levelId` from the route and filters `/api/scenes` to that level.
  **Scoped to a scene**: owns
  `sceneId` + `currentId`; selecting a scene loads its root via `GET /api/dialogues?scene_id=`, then
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
  - `GET /api/projects`, `POST /api/projects` (create; auto-appends `order`), `GET /api/projects/{id}`,
    `PATCH /api/projects/{id}` — the **Project** (top-level game). One PATCH serves rename,
    Settings (`dimension`/`genre`), Systems (`systems` JSON), and Preview (`hud_layout` JSON).
  - `GET /api/levels` (optional `?project_id=` filter), `POST /api/levels` (create; auto-appends
    `order`, takes `project_id`), `GET /api/levels/{id}`, `PATCH /api/levels/{id}` (rename) — the
    project's Levels list + per-level hub.
  - Endpoints used by the dialogue editor: `GET /api/characters`, `GET /api/scenes`,
    `GET /api/dialogues?scene_id=` (a scene's roots), `GET /api/dialogues/{id}` (node + its
    `responses`), `POST /api/dialogues` (create; `scene_id`/`parent_id`/`character_id`/`text`),
    `PATCH /api/dialogues/{id}` (partial update of `text`/`character_id`).
  - `GET /api/user` / `PATCH /api/user` — the **current user**. No real auth yet, so this is a
    single default user (created on first access via `_current_user()`); it stores per-user
    settings like the UI `theme`.
  - Interactive API docs (Swagger UI) at `/api/docs`; OpenAPI at `/api/openapi.json` (drives the
    frontend's `gen:api`).
- `api/models.py`: `Project → Level → Scene` (FKs), `Scene ↔ Character` (M2M), and `Dialogue` — a
  self-referential branching node (`scene` FK, `parent` FK to self, `character` FK, `text`).
  A dialogue's children are `dialogue.responses`; a scene's tree is its `parent=None` roots.
  **`Project`** is the top-level game container: `name`/`order` plus first-class `dimension` and
  `genre` columns, and two **JSONB** fields — `systems` (the per-system enabled+answers, shape
  defined by `gameSystems.ts`) and `hud_layout` (`{systemId: {x,y}}`). Hybrid on purpose: the
  evolving question set stays in frontend code, so its *answers* live in JSON to avoid a migration
  per question; only stable `dimension`/`genre` are columns. `User` holds per-user settings
  (currently `theme`); no auth yet, so a single default user.
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
