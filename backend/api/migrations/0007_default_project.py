"""Backfill: ensure existing levels belong to a project.

Levels predate the Project model, so create a single "Default Project" and attach any
project-less levels to it. Reversible by simply detaching them again.
"""
from django.db import migrations


def assign_default_project(apps, schema_editor):
    Level = apps.get_model("api", "Level")
    Project = apps.get_model("api", "Project")

    orphans = Level.objects.filter(project__isnull=True)
    if not orphans.exists():
        return

    project, _ = Project.objects.get_or_create(
        name="Default Project", defaults={"order": 0}
    )
    orphans.update(project=project)


def detach_levels(apps, schema_editor):
    Level = apps.get_model("api", "Level")
    Project = apps.get_model("api", "Project")
    Level.objects.filter(project__name="Default Project").update(project=None)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_project_level_project"),
    ]

    operations = [
        migrations.RunPython(assign_default_project, detach_levels),
    ]
