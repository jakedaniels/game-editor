"""Backfill: ensure existing characters belong to a project.

Characters predate per-project scoping, so attach any project-less character to the first
Project (creating a "Default Project" only if none exists). Reversible by detaching them.
"""
from django.db import migrations


def assign_default_project(apps, schema_editor):
    Character = apps.get_model("api", "Character")
    Project = apps.get_model("api", "Project")

    orphans = Character.objects.filter(project__isnull=True)
    if not orphans.exists():
        return

    project = Project.objects.order_by("order", "id").first()
    if project is None:
        project = Project.objects.create(name="Default Project", order=0)
    orphans.update(project=project)


def detach_characters(apps, schema_editor):
    # Non-destructive reverse: leave characters attached (project may be legitimately used).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_alter_character_options_character_created_at_and_more"),
    ]

    operations = [
        migrations.RunPython(assign_default_project, detach_characters),
    ]
