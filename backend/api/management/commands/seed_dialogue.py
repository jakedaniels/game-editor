"""Seed branching dialogue trees, one per scene, so the editor has content to navigate.

Idempotent: clears existing dialogues and recreates fresh trees. Run with:
    python manage.py seed_dialogue
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Character, Dialogue, Level, Scene


class Command(BaseCommand):
    help = "Seed demo data: a level, scenes, characters, and a branching dialogue tree per scene."

    @transaction.atomic
    def handle(self, *args, **options):
        # Reset dialogues for a clean, repeatable seed.
        Dialogue.objects.all().delete()

        level, _ = Level.objects.get_or_create(name="Level 12", defaults={"order": 12})
        scene5, _ = Scene.objects.get_or_create(level=level, name="Scene 5", defaults={"order": 5})
        scene6, _ = Scene.objects.get_or_create(level=level, name="Scene 6", defaults={"order": 6})

        hero, _ = Character.objects.get_or_create(name="Hero")
        guide, _ = Character.objects.get_or_create(name="Guide")
        merchant, _ = Character.objects.get_or_create(name="Merchant")
        for c in (hero, guide, merchant):
            scene5.characters.add(c)
        scene6.characters.add(hero, guide)

        # --- Scene 5: the crossroads ---------------------------------------------------------
        root5 = Dialogue.objects.create(
            scene=scene5,
            character=guide,
            text="Welcome, traveler. The road ahead is dangerous. What will you do?",
        )
        ask = Dialogue.objects.create(scene=scene5, parent=root5, character=hero, text="Tell me more about the danger.")
        shop = Dialogue.objects.create(scene=scene5, parent=root5, character=hero, text="I'd like to buy supplies first.")
        leave = Dialogue.objects.create(scene=scene5, parent=root5, character=hero, text="I'll go it alone. Step aside.")
        Dialogue.objects.create(scene=scene5, parent=root5, character=hero, text="Who are you, really?")
        Dialogue.objects.create(scene=scene5, parent=root5, character=hero, text="Do you have a map I can use?")
        Dialogue.objects.create(scene=scene5, parent=root5, character=hero, text="Is there another way around?")

        Dialogue.objects.create(scene=scene5, parent=ask, character=guide, text="Bandits hold the pass. They are many.")
        Dialogue.objects.create(scene=scene5, parent=ask, character=guide, text="A dragon sleeps beyond the ridge. Tread softly.")
        Dialogue.objects.create(scene=scene5, parent=shop, character=merchant, text="Potions and rope, half price for you.")
        Dialogue.objects.create(scene=scene5, parent=shop, character=hero, text="On second thought, I have no coin.")
        Dialogue.objects.create(scene=scene5, parent=leave, character=guide, text="Then may fortune favor your reckless heart.")

        # --- Scene 6: the campfire -----------------------------------------------------------
        root6 = Dialogue.objects.create(
            scene=scene6,
            character=guide,
            text="The fire is warm. We should rest before the climb. Care to talk?",
        )
        Dialogue.objects.create(scene=scene6, parent=root6, character=hero, text="What lies at the summit?")
        Dialogue.objects.create(scene=scene6, parent=root6, character=hero, text="Tell me of your past.")
        Dialogue.objects.create(scene=scene6, parent=root6, character=hero, text="Let's just sleep. Goodnight.")

        total = Dialogue.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {total} dialogues across {scene5.name} (root {root5.id}) and "
                f"{scene6.name} (root {root6.id})."
            )
        )
