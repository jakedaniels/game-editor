from django.db import migrations, models
import django.db.models.deletion


def backfill_titles_and_edges(apps, schema_editor):
    Dialogue = apps.get_model("api", "Dialogue")
    DialogueEdge = apps.get_model("api", "DialogueEdge")

    for dialogue in Dialogue.objects.order_by("id"):
        dialogue.title = f"node{dialogue.pk}"
        dialogue.save(update_fields=["title"])

    sibling_counts: dict[int, int] = {}
    for dialogue in Dialogue.objects.order_by("id"):
        if dialogue.parent_id is None:
            continue
        order = sibling_counts.get(dialogue.parent_id, 0)
        sibling_counts[dialogue.parent_id] = order + 1
        DialogueEdge.objects.create(
            from_node_id=dialogue.parent_id, to_node_id=dialogue.id, order=order
        )


def restore_parent_from_edges(apps, schema_editor):
    Dialogue = apps.get_model("api", "Dialogue")
    DialogueEdge = apps.get_model("api", "DialogueEdge")
    for edge in DialogueEdge.objects.all():
        Dialogue.objects.filter(pk=edge.to_node_id).update(parent_id=edge.from_node_id)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0015_dialogue_effects_dialogue_requirements_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="dialogue",
            name="title",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.CreateModel(
            name="DialogueEdge",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("option_label", models.CharField(blank=True, default="", max_length=200)),
                ("order", models.PositiveIntegerField(default=0)),
                (
                    "from_node",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="outgoing_edges",
                        to="api.dialogue",
                    ),
                ),
                (
                    "to_node",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incoming_edges",
                        to="api.dialogue",
                    ),
                ),
            ],
            options={"ordering": ["order", "id"]},
        ),
        migrations.RunPython(backfill_titles_and_edges, restore_parent_from_edges),
        migrations.RemoveField(
            model_name="dialogue",
            name="parent",
        ),
        migrations.AlterField(
            model_name="dialogue",
            name="title",
            field=models.CharField(max_length=100, unique=True),
        ),
        migrations.AddConstraint(
            model_name="dialogueedge",
            constraint=models.UniqueConstraint(
                fields=("from_node", "to_node"), name="uniq_dialogue_edge"
            ),
        ),
    ]
