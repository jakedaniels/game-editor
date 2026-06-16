# game-editor

A Figma-like design platform. Two pages so far: a **shape editor** (create/move SVG shape
outlines) and a **branching dialogue editor** (navigate a tree of dialogue nodes), backed by a
Django + Django Ninja API with end-to-end TypeScript types.

## Stack

- **Frontend:** React 19 + TypeScript 6, bundled with Vite 8. Shapes rendered as SVG. (npm)
- **Backend:** Django 5.2 + Django Ninja, Python 3.11. Postgres 14 database.
- **Structure:** polyglot monorepo — `frontend/` (npm workspace) and `backend/` (Python venv).

## Prerequisites

- Node 24 (LTS) + npm 11 — frontend
- Python 3.11 — backend
- PostgreSQL 14 running locally (Homebrew: `brew services start postgresql@14`)

## Getting started

### Frontend

```bash
npm install        # installs the frontend workspace
```

### Backend

The Python virtualenv lives at `backend/.venv`. To set it up from scratch:

```bash
cd backend
python3.11 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env          # local defaults already target the game_editor db
```

The local database is a Postgres db named `game_editor` owned by role `game_editor`
(password `game_editor`). Apply migrations and seed demo dialogue data:

```bash
./.venv/bin/python manage.py migrate
./.venv/bin/python manage.py seed_dialogue   # a small Level/Scene/Characters + dialogue tree
```

### Run everything

From the repo root:

```bash
npm run dev        # frontend (http://localhost:5173) + backend (http://localhost:8000)
```

Or individually:

```bash
npm run dev:web    # frontend only  -> http://localhost:5173
npm run dev:api    # backend only   -> http://localhost:8000  (runs Django via backend/.venv)
```

## Using the editors

**Shapes** (`/`): pick the Rectangle/Ellipse tool and click-drag to draw an outline; switch to
Select and drag a shape to move it.

**Dialogue** (`/dialogue`): the left menu lists scenes (under their level), the right menu lists
characters. The center shows the current dialogue node (speaker, text, metadata placeholders);
the horizontal **Responses** row holds its children — click one to dive in, or use *Back to
parent* to go up.

## Backend API & typed frontend

Built with Django Ninja. Interactive docs (Swagger UI) at http://localhost:8000/api/docs.

- `GET /api/characters`, `GET /api/scenes`, `GET /api/dialogues`, `GET /api/dialogues/{id}`
- `POST /api/auth` — placeholder, always **HTTP 400** (not called by the frontend).

The frontend consumes these with **fully typed** requests/responses. Regenerate the types after
any API/schema change (backend must be running):

```bash
npm run gen:api -w frontend   # writes frontend/src/api/schema.d.ts from /api/openapi.json
```

See `CLAUDE.md` for architecture notes and conventions.
