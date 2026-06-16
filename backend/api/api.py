"""Django Ninja API for the game-editor backend.

Mounted at /api/ (see config/urls.py). Interactive docs are served at /api/docs.
The schemas here drive the OpenAPI spec, which the frontend turns into typed TS
(`npm run gen:api` -> frontend/src/api/schema.d.ts).
"""
from django.shortcuts import get_object_or_404
from ninja import NinjaAPI, Schema

from .models import Character, Dialogue, Scene

api = NinjaAPI(title="game-editor API", version="0.1.0")


# --- Schemas ----------------------------------------------------------------------------------
class Error(Schema):
    error: str


class CharacterOut(Schema):
    id: int
    name: str


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


# --- Characters / Scenes (sidebars) -----------------------------------------------------------
@api.get("/characters", response=list[CharacterOut], summary="List characters")
def list_characters(request):
    return list(Character.objects.all())


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
