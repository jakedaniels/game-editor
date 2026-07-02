"""Make CharacterRelationship directed (unidirectional).

Renames the symmetric `character_a`/`character_b` pair to `from_character`/`to_character`,
updates related names, and swaps the unique constraint. Written explicitly (rather than via
autodetection) to preserve the existing relationship rows as directed edges.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_characters_default_project"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="characterrelationship",
            name="uniq_char_pair",
        ),
        migrations.RenameField(
            model_name="characterrelationship",
            old_name="character_a",
            new_name="from_character",
        ),
        migrations.RenameField(
            model_name="characterrelationship",
            old_name="character_b",
            new_name="to_character",
        ),
        migrations.AlterField(
            model_name="characterrelationship",
            name="from_character",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="relationships_out",
                to="api.character",
            ),
        ),
        migrations.AlterField(
            model_name="characterrelationship",
            name="to_character",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="relationships_in",
                to="api.character",
            ),
        ),
        migrations.AddConstraint(
            model_name="characterrelationship",
            constraint=models.UniqueConstraint(
                fields=("from_character", "to_character"), name="uniq_char_relationship"
            ),
        ),
    ]
