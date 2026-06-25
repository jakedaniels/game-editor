"""Django Ninja API for the game-editor backend.

Mounted at /api/ (see config/urls.py). Interactive docs are served at /api/docs.
The schemas here drive the OpenAPI spec, which the frontend turns into typed TS
(`npm run gen:api` -> frontend/src/api/schema.d.ts).
"""
from django.shortcuts import get_object_or_404
from ninja import NinjaAPI, Schema

from typing import Any

from .models import Character, Dialogue, Level, Project, Scene, User

api = NinjaAPI(title="game-editor API", version="0.1.0")

VALID_THEMES = {choice for choice, _ in User.THEME_CHOICES}


# --- Schemas ----------------------------------------------------------------------------------
class Error(Schema):
    error: str


class UserOut(Schema):
    id: int
    name: str
    theme: str


class UserUpdateIn(Schema):
    """Partial update of the current user (e.g. their selected theme)."""

    name: str | None = None
    theme: str | None = None


class CharacterOut(Schema):
    id: int
    name: str


class ProjectOut(Schema):
    """A game project plus its game-wide config (settings/systems/HUD)."""

    id: int
    name: str
    order: int
    dimension: str
    genre: str
    systems: dict[str, Any] = {}  # ArchitectState (per-system enabled + answers)
    hud_layout: dict[str, Any] = {}  # HudLayout ({systemId: {x, y}})


class ProjectCreateIn(Schema):
    name: str = "New Project"
    order: int | None = None  # None => appended after the current last project


class ProjectUpdateIn(Schema):
    """Partial update — omitted fields are left unchanged. One PATCH serves rename,
    Settings (dimension/genre), Systems, and Preview (hud_layout) saves."""

    name: str | None = None
    order: int | None = None
    dimension: str | None = None
    genre: str | None = None
    systems: dict[str, Any] | None = None
    hud_layout: dict[str, Any] | None = None


class LevelOut(Schema):
    id: int
    name: str
    order: int
    project_id: int | None = None


class LevelUpdateIn(Schema):
    """Partial update of a level (e.g. its title)."""

    name: str | None = None
    order: int | None = None


class LevelCreateIn(Schema):
    name: str = "New Level"
    order: int | None = None  # None => appended after the current last level
    project_id: int | None = None


class SceneOut(Schema):
    id: int
    name: str
    level_id: int
    level_name: str


class DialogueSummaryOut(Schema):
    """Lightweight dialogue used for root lists and response cards."""

    id: int
    text: str
    character: CharacterOut | None = None


class DialogueDetailOut(Schema):
    """The current dialogue plus its immediate responses (the wheel)."""

    id: int
    text: str
    scene_id: int | None = None
    parent_id: int | None = None
    character: CharacterOut | None = None
    responses: list[DialogueSummaryOut] = []


class DialogueIn(Schema):
    """Payload to create a dialogue (optionally as a response of `parent_id`)."""

    scene_id: int | None = None
    parent_id: int | None = None
    character_id: int | None = None
    text: str = ""


class DialogueUpdateIn(Schema):
    """Partial update — omitted fields are left unchanged."""

    character_id: int | None = None
    text: str | None = None


# --- Auth (placeholder) -----------------------------------------------------------------------
@api.post("/auth", response={400: Error}, summary="Authenticate the user (placeholder)")
def auth(request):
    """Placeholder for future authentication.

    Always returns HTTP 400 and is intentionally NOT called by the frontend yet.
    """
    return 400, {"error": "Authentication not implemented"}


# --- Current user (single default user — no real auth yet) ------------------------------------
def _current_user() -> User:
    """The app's single user. Created on first access since there's no auth/login."""
    user = User.objects.order_by("id").first()
    if user is None:
        user = User.objects.create()
    return user


@api.get("/user", response=UserOut, summary="Get the current user")
def get_current_user(request):
    return _current_user()


@api.patch("/user", response=UserOut, summary="Update the current user")
def update_current_user(request, payload: UserUpdateIn):
    user = _current_user()
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        user.name = data["name"]
    if "theme" in data and data["theme"] in VALID_THEMES:
        user.theme = data["theme"]
    user.save()
    return user


# --- Characters / Scenes (sidebars) -----------------------------------------------------------
@api.get("/characters", response=list[CharacterOut], summary="List characters")
def list_characters(request):
    return list(Character.objects.all())


# --- Projects (top-level game container) ------------------------------------------------------
@api.get("/projects", response=list[ProjectOut], summary="List projects")
def list_projects(request):
    return list(Project.objects.all())


@api.post("/projects", response={201: ProjectOut}, summary="Create a project")
def create_project(request, payload: ProjectCreateIn):
    if payload.order is not None:
        order = payload.order
    else:
        last = Project.objects.order_by("-order").first()
        order = (last.order + 1) if last else 0
    project = Project.objects.create(name=payload.name, order=order)
    return 201, project


@api.get("/projects/{int:project_id}", response=ProjectOut, summary="Get a project")
def get_project(request, project_id: int):
    return get_object_or_404(Project, id=project_id)


@api.patch("/projects/{int:project_id}", response=ProjectOut, summary="Update a project")
def update_project(request, project_id: int, payload: ProjectUpdateIn):
    """Partial update: rename, Settings (dimension/genre), Systems, or Preview (hud_layout)."""
    project = get_object_or_404(Project, id=project_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        project.name = data["name"]
    if "order" in data and data["order"] is not None:
        project.order = data["order"]
    if "dimension" in data and data["dimension"] is not None:
        project.dimension = data["dimension"]
    if "genre" in data and data["genre"] is not None:
        project.genre = data["genre"]
    if "systems" in data and data["systems"] is not None:
        project.systems = data["systems"]
    if "hud_layout" in data and data["hud_layout"] is not None:
        project.hud_layout = data["hud_layout"]
    project.save()
    return project


@api.get("/levels", response=list[LevelOut], summary="List levels")
def list_levels(request, project_id: int | None = None):
    """All levels, or just one project's levels when `project_id` is given."""
    qs = Level.objects.all()
    if project_id is not None:
        qs = qs.filter(project_id=project_id)
    return list(qs)


@api.post("/levels", response={201: LevelOut}, summary="Create a level")
def create_level(request, payload: LevelCreateIn):
    if payload.order is not None:
        order = payload.order
    else:
        last = Level.objects.order_by("-order").first()
        order = (last.order + 1) if last else 0
    level = Level.objects.create(
        name=payload.name, order=order, project_id=payload.project_id
    )
    return 201, level


@api.get("/levels/{int:level_id}", response=LevelOut, summary="Get a level")
def get_level(request, level_id: int):
    return get_object_or_404(Level, id=level_id)


@api.patch("/levels/{int:level_id}", response=LevelOut, summary="Update a level")
def update_level(request, level_id: int, payload: LevelUpdateIn):
    level = get_object_or_404(Level, id=level_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        level.name = data["name"]
    if "order" in data and data["order"] is not None:
        level.order = data["order"]
    level.save()
    return level


@api.get("/scenes", response=list[SceneOut], summary="List scenes")
def list_scenes(request):
    scenes = Scene.objects.select_related("level").all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "level_id": s.level_id,
            "level_name": s.level.name,
        }
        for s in scenes
    ]


# --- Dialogues (branching tree) ---------------------------------------------------------------
@api.get("/dialogues", response=list[DialogueSummaryOut], summary="List root dialogues")
def list_root_dialogues(request, scene_id: int | None = None):
    """Root dialogues (no parent). Pass `scene_id` to get the roots for one scene."""
    qs = Dialogue.objects.filter(parent__isnull=True).select_related("character")
    if scene_id is not None:
        qs = qs.filter(scene_id=scene_id)
    return list(qs)


def _dialogue_detail(dialogue_id: int) -> Dialogue:
    """Fetch a dialogue with the relations needed to serialize DialogueDetailOut."""
    return get_object_or_404(
        Dialogue.objects.select_related("character").prefetch_related("responses__character"),
        id=dialogue_id,
    )


@api.get("/dialogues/{int:dialogue_id}", response=DialogueDetailOut, summary="Get a dialogue")
def get_dialogue(request, dialogue_id: int):
    """A dialogue with its character and immediate responses (its children)."""
    return _dialogue_detail(dialogue_id)


@api.post("/dialogues", response={201: DialogueDetailOut}, summary="Create a dialogue")
def create_dialogue(request, payload: DialogueIn):
    """Create a dialogue node. Pass `parent_id` to attach it as a response of another node."""
    dialogue = Dialogue.objects.create(
        scene_id=payload.scene_id,
        parent_id=payload.parent_id,
        character_id=payload.character_id,
        text=payload.text,
    )
    return 201, _dialogue_detail(dialogue.id)


@api.patch("/dialogues/{int:dialogue_id}", response=DialogueDetailOut, summary="Update a dialogue")
def update_dialogue(request, dialogue_id: int, payload: DialogueUpdateIn):
    """Partial update: only the fields present in the request body are changed."""
    dialogue = get_object_or_404(Dialogue, id=dialogue_id)
    data = payload.model_dump(exclude_unset=True)
    if "text" in data:
        dialogue.text = data["text"] or ""
    if "character_id" in data:
        dialogue.character_id = data["character_id"]
    dialogue.save()
    return _dialogue_detail(dialogue.id)
