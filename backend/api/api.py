"""Django Ninja API for the game-editor backend.

Mounted at /api/ (see config/urls.py). Interactive docs are served at /api/docs.
The schemas here drive the OpenAPI spec, which the frontend turns into typed TS
(`npm run gen:api` -> frontend/src/api/schema.d.ts).
"""
from django.shortcuts import get_object_or_404
from ninja import File, NinjaAPI, Schema
from ninja.files import UploadedFile

from .services import imagegen, storage

from typing import Any

from .models import (
    Character,
    CharacterRelationship,
    Dialogue,
    Level,
    Project,
    Scene,
    User,
)

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
    description: str = ""
    image_url: str = ""  # derived (presigned) from the character's image_key at read time

    @staticmethod
    def resolve_image_url(obj) -> str:
        key = obj.get("image_key", "") if isinstance(obj, dict) else getattr(obj, "image_key", "")
        return storage.view_url(key)


class RelatedCharacterOut(Schema):
    """A character related to another, plus the relationship's label and edge id."""

    relationship_id: int
    id: int
    name: str
    relationship: str


class CharacterDetailOut(Schema):
    """A single character with its description, portrait, and relationships."""

    id: int
    name: str
    description: str = ""
    image_url: str = ""
    image_key: str = ""
    project_id: int | None = None
    related: list[RelatedCharacterOut] = []


class CharacterCreateIn(Schema):
    name: str = "New Character"
    description: str = ""
    project_id: int | None = None


class CharacterUpdateIn(Schema):
    """Partial update — omitted fields are left unchanged."""

    name: str | None = None
    description: str | None = None


class RelationshipCreateIn(Schema):
    other_id: int
    relationship: str = ""


class GenerateImageIn(Schema):
    # Optional; defaults to a prompt built from the character's name + description.
    prompt: str | None = None


class ProjectOut(Schema):
    """A game project plus its game-wide config (settings/systems/HUD)."""

    id: int
    name: str
    order: int
    dimension: str
    genre: str
    systems: dict[str, Any] = {}  # ArchitectState (per-system enabled + answers)
    hud_layout: dict[str, Any] = {}  # HudLayout ({systemId: {x, y}})
    state_schema: dict[str, Any] = {} # this is to help track effects/requirements in choices in dialogue


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
    state_schema: dict[str, Any] | None = None 


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


class LevelCharacterLineOut(Schema):
    id: int
    text: str
    scene_id: int | None = None
    scene_name: str = ""


class LevelCharacterOut(Schema):
    """A character appearing in a level (deduced from dialogue), with the lines they speak."""

    id: int
    name: str
    description: str = ""
    image_url: str = ""
    lines: list[LevelCharacterLineOut] = []


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
    requirements: list[dict[str, Any]] = []
    effects: list[dict[str, Any]] = []


class DialogueDetailOut(Schema):
    """The current dialogue plus its immediate responses (the wheel)."""

    id: int
    text: str
    scene_id: int | None = None
    parent_id: int | None = None
    character: CharacterOut | None = None
    requirements: list[dict[str, Any]] = []
    effects: list[dict[str, Any]] = []
    responses: list[DialogueSummaryOut] = []


class DialogueNodeOut(Schema):
    """A single node in a scene's flat dialogue list — enough to lay out the whole tree."""

    id: int
    parent_id: int | None = None
    text: str
    character: CharacterOut | None = None
    requirements: list[dict[str, Any]] = []
    effects: list[dict[str, Any]] = []


class DialogueIn(Schema):
    """Payload to create a dialogue (optionally as a response of `parent_id`)."""

    scene_id: int | None = None
    parent_id: int | None = None
    character_id: int | None = None
    text: str = ""
    requirements: list[dict[str, Any]] | None = None
    effects: list[dict[str, Any]] | None = None


class DialogueUpdateIn(Schema):
    """Partial update — omitted fields are left unchanged."""

    character_id: int | None = None
    text: str | None = None
    requirements: list[dict[str, Any]] | None = None
    effects: list[dict[str, Any]] | None = None


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


# --- Characters -------------------------------------------------------------------------------
def _related_for(character: Character) -> list[dict]:
    """Directed relationships: this character's *outgoing* edges (from → to)."""
    rels = (
        CharacterRelationship.objects.filter(from_character=character)
        .select_related("to_character")
        .order_by("to_character__name")
    )
    return [
        {
            "relationship_id": rel.id,
            "id": rel.to_character_id,
            "name": rel.to_character.name,
            "relationship": rel.relationship,
        }
        for rel in rels
    ]


def _portrait_key_prefix(character: Character) -> str:
    """S3 folder for a character's portraits: Characters/Project-<pid>/character-<cid>.

    Multiple images can live in this folder (each upload gets a unique filename).
    """
    project = f"Project-{character.project_id}" if character.project_id else "Project-none"
    return f"Characters/{project}/character-{character.id}"


def _character_detail(character: Character) -> dict:
    return {
        "id": character.id,
        "name": character.name,
        "description": character.description,
        "image_url": storage.view_url(character.image_key),
        "image_key": character.image_key,
        "project_id": character.project_id,
        "related": _related_for(character),
    }


@api.get("/characters", response=list[CharacterOut], summary="List characters")
def list_characters(request, project_id: int | None = None):
    """All characters, or just one project's characters when `project_id` is given."""
    qs = Character.objects.all()
    if project_id is not None:
        qs = qs.filter(project_id=project_id)
    return list(qs)


@api.post("/characters", response={201: CharacterOut}, summary="Create a character")
def create_character(request, payload: CharacterCreateIn):
    character = Character.objects.create(
        name=payload.name, description=payload.description, project_id=payload.project_id
    )
    return 201, character


@api.get("/characters/{int:character_id}", response=CharacterDetailOut, summary="Get a character")
def get_character(request, character_id: int):
    return _character_detail(get_object_or_404(Character, id=character_id))


@api.patch("/characters/{int:character_id}", response=CharacterDetailOut, summary="Update a character")
def update_character(request, character_id: int, payload: CharacterUpdateIn):
    character = get_object_or_404(Character, id=character_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        character.name = data["name"]
    if "description" in data and data["description"] is not None:
        character.description = data["description"]
    character.save()
    return _character_detail(character)


@api.post(
    "/characters/{int:character_id}/relationships",
    response={201: CharacterDetailOut, 400: Error, 404: Error},
    summary="Add or update a relationship",
)
def add_relationship(request, character_id: int, payload: RelationshipCreateIn):
    """Directed: creates an edge from this character to `other_id`. Shows only on this
    character's page. If the same directed edge already exists, its label is updated."""
    character = get_object_or_404(Character, id=character_id)
    if payload.other_id == character_id:
        return 400, {"error": "A character cannot relate to itself"}
    other = Character.objects.filter(id=payload.other_id).first()
    if other is None:
        return 404, {"error": "Other character not found"}
    if other.project_id != character.project_id:
        return 400, {"error": "Characters must be in the same project"}

    CharacterRelationship.objects.update_or_create(
        from_character=character,
        to_character=other,
        defaults={"relationship": payload.relationship},
    )
    return 201, _character_detail(character)


@api.delete(
    "/characters/{int:character_id}/relationships/{int:relationship_id}",
    response={204: None},
    summary="Remove a relationship",
)
def delete_relationship(request, character_id: int, relationship_id: int):
    get_object_or_404(CharacterRelationship, id=relationship_id).delete()
    return 204, None


@api.post(
    "/characters/{int:character_id}/image",
    response={200: CharacterDetailOut, 400: Error, 503: Error},
    summary="Upload a character portrait",
)
def upload_character_image(request, character_id: int, file: UploadedFile = File(...)):
    """Upload an image file for the character; stores it in S3 and saves the public URL."""
    character = get_object_or_404(Character, id=character_id)
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        return 400, {"error": "File must be an image."}
    try:
        _url, key = storage.upload_image(
            file.read(), content_type, key_prefix=_portrait_key_prefix(character)
        )
    except storage.StorageNotConfigured as exc:
        return 503, {"error": str(exc)}
    except storage.StorageError as exc:
        return 400, {"error": f"Upload failed: {exc}"}
    character.image_key = key
    character.save(update_fields=["image_key", "updated_at"])
    return 200, _character_detail(character)


@api.post(
    "/characters/{int:character_id}/generate-image",
    response={200: CharacterDetailOut, 400: Error, 503: Error},
    summary="Generate a character portrait with AI",
)
def generate_character_image(request, character_id: int, payload: GenerateImageIn):
    """Generate a portrait with FLUX (fal.ai), upload it to S3, and save the key on the character."""
    character = get_object_or_404(Character, id=character_id)
    prompt = (payload.prompt or "").strip() or imagegen.default_prompt(
        character.name, character.description
    )
    try:
        data, content_type = imagegen.generate_image(prompt)
        _url, key = storage.upload_image(
            data, content_type, key_prefix=_portrait_key_prefix(character)
        )
    except (imagegen.GenerationNotConfigured, storage.StorageNotConfigured) as exc:
        return 503, {"error": str(exc)}
    except (imagegen.GenerationError, storage.StorageError) as exc:
        return 400, {"error": str(exc)}
    character.image_key = key
    character.save(update_fields=["image_key", "updated_at"])
    return 200, _character_detail(character)


# --- Scenes (dialogue sidebars) ---------------------------------------------------------------


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
    if "state_schema" in data and data["state_schema"] is not None:
        project.state_schema = data["state_schema"]
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


@api.get(
    "/levels/{int:level_id}/characters",
    response=list[LevelCharacterOut],
    summary="Characters in a level (deduced from dialogue)",
)
def level_characters(request, level_id: int):
    """The level's cast, deduced from which characters speak its dialogue, each with the
    lines they speak (across the level's scenes). Ordered by character name."""
    get_object_or_404(Level, id=level_id)
    dialogues = (
        Dialogue.objects.filter(scene__level_id=level_id, character__isnull=False)
        .select_related("character", "scene")
        .order_by("character__name", "scene__order", "id")
    )
    by_char: dict[int, dict] = {}
    for d in dialogues:
        c = d.character
        entry = by_char.get(c.id)
        if entry is None:
            entry = {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "image_url": storage.view_url(c.image_key),
                "lines": [],
            }
            by_char[c.id] = entry
        entry["lines"].append(
            {
                "id": d.id,
                "text": d.text,
                "scene_id": d.scene_id,
                "scene_name": d.scene.name if d.scene else "",
            }
        )
    return list(by_char.values())


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


@api.get(
    "/scenes/{int:scene_id}/dialogues",
    response=list[DialogueNodeOut],
    summary="All dialogue nodes in a scene (flat, for the tree view)",
)
def scene_dialogue_tree(request, scene_id: int):
    """Every dialogue node in a scene as a flat list — the frontend builds the tree from
    `id`/`parent_id`. One JOIN (no N+1); each node's character serializes like everywhere else
    (presigned image URL via CharacterOut)."""
    get_object_or_404(Scene, id=scene_id)
    return list(Dialogue.objects.filter(scene_id=scene_id).select_related("character"))


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
        requirements=payload.requirements or [],
        effects=payload.effects or [],
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
    if "requirements" in data and data["requirements"] is not None:
        dialogue.requirements = data["requirements"]
    if "effects" in data and data["effects"] is not None:
        dialogue.effects = data["effects"]
    dialogue.save()
    return _dialogue_detail(dialogue.id)
