from django.db import models


class User(models.Model):
    """A user of the editor. No real auth yet — the app uses a single default user,
    which is where per-user settings (like the UI theme) are persisted."""

    THEME_NEON = "neon"
    THEME_AQUA = "aqua"
    THEME_LIGHT = "light"
    THEME_STUDIO = "studio"
    THEME_CHOICES = [
        (THEME_NEON, "Neon"),
        (THEME_AQUA, "Aqua"),
        (THEME_LIGHT, "Light"),
        (THEME_STUDIO, "Studio"),
    ]

    name = models.CharField(max_length=50, default="Player")
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default=THEME_NEON)

    def __str__(self) -> str:
        return self.name


class Project(models.Model):
    """A game project — the top-level container above Levels.

    Holds game-wide configuration captured by the Settings/Systems/Preview tabs:
    `dimension` and `genre` are first-class columns (stable, queryable), while the
    evolving per-system answers (`systems`) and HUD layout (`hud_layout`) live in JSONB
    because their shape is defined by frontend code and changes often.
    """

    name = models.CharField(max_length=100, default="New Project")
    order = models.PositiveIntegerField(default=0)
    dimension = models.CharField(max_length=2, blank=True, default="")  # "2d" | "3d" | ""
    genre = models.CharField(max_length=30, blank=True, default="")
    systems = models.JSONField(default=dict, blank=True)  # ArchitectState: per-system enabled+answers
    hud_layout = models.JSONField(default=dict, blank=True)  # HudLayout: {systemId: {x, y}}
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.name


class Level(models.Model):
    """A level in the game. Belongs to a project; contains an ordered set of scenes."""

    project = models.ForeignKey(
        Project, null=True, blank=True, on_delete=models.CASCADE, related_name="levels"
    )
    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.name


class Character(models.Model):
    """A character that can appear in scenes and speak dialogue."""

    name = models.CharField(max_length=30)

    def __str__(self) -> str:
        return self.name


class Scene(models.Model):
    """A scene within a level. Contains the characters present in it."""

    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name="scenes")
    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)
    # A character can appear in many scenes, so this is many-to-many.
    characters = models.ManyToManyField(Character, related_name="scenes", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.level.name} / {self.name}"


class Dialogue(models.Model):
    """A node in a branching dialogue tree.

    Intentionally basic for now (to be expanded later): a dialogue has a parent dialogue
    (None == root), the character who speaks it, and its text. A dialogue's `responses`
    (its children) are the branches shown in the editor's response wheel.
    """

    scene = models.ForeignKey(
        Scene, null=True, blank=True, on_delete=models.CASCADE, related_name="dialogues"
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="responses"
    )
    character = models.ForeignKey(
        Character, null=True, blank=True, on_delete=models.SET_NULL, related_name="dialogues"
    )
    text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        speaker = self.character.name if self.character else "—"
        return f"{speaker}: {self.text[:40]}"
