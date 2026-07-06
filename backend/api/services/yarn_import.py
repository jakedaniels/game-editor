"""Import a Yarn script into a scene's dialogue graph.

Supports a bounded subset of Yarn — enough to express the branching structure the editor
already models (nodes are lines, edges are responses) using the same requirement/effect
vocabulary the UI exposes (`has_item`/`stat_check`/`state_equals`/`remembered_choice` and
`give_item`/`remove_item`/`change_stat`/`set_flag`/`remember_choice`):

    title: NodeTitle
    ---
    Speaker: A line of dialogue.
    Speaker: Another line.
    <<if $some_flag>>
    -> An option gated by that flag
        <<jump OtherNodeTitle>>
    -> An option with its own inline continuation
        Speaker: Said only if this option is picked.
    <<set $some_flag = true>>
    ===

`<<jump X>>` may target a node defined later in the same paste, or an existing node already
in the project (by `title`) — both are resolved in a second pass, so branches can converge
back onto content that's already there. Constructs outside this subset (nested
`<<if>>...<<endif>>` guarding plain lines, functions, string variables, absolute numeric
`<<set>>`) are reported as warnings and skipped rather than guessed at; anything that leaves
a jump target genuinely unresolvable aborts the whole import (nothing partially written).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Union

from django.db import transaction

from ..models import Character, Dialogue, DialogueEdge, Scene


class YarnImportError(Exception):
    def __init__(self, message: str, warnings: list[str] | None = None):
        super().__init__(message)
        self.warnings = warnings or []


# --- AST ----------------------------------------------------------------------------------
@dataclass
class LineEntry:
    speaker: str | None
    text: str


@dataclass
class JumpEntry:
    target: str


@dataclass
class SetEntry:
    effect: dict


@dataclass
class OptionEntry:
    label: str
    requirement: dict | None
    jump_target: str | None
    body: list["Entry"] = field(default_factory=list)


Entry = Union[LineEntry, JumpEntry, SetEntry, OptionEntry]

TITLE_RE = re.compile(r"^title:\s*(.+?)\s*$")
BODY_START_RE = re.compile(r"^---\s*$")
BODY_END_RE = re.compile(r"^===\s*$")
JUMP_RE = re.compile(r"^<<\s*jump\s+(\w+)\s*>>$", re.IGNORECASE)
IF_RE = re.compile(r"^<<\s*if\s+(!)?\$(\w+)\s*(>=|<=|==|<|>)?\s*([\w.]+)?\s*>>$", re.IGNORECASE)
ENDIF_RE = re.compile(r"^<<\s*endif\s*>>$", re.IGNORECASE)
SET_RE = re.compile(r"^<<\s*set\s+\$(\w+)\s*=\s*(true|false|[\d.]+)\s*>>$", re.IGNORECASE)
OPTION_RE = re.compile(r"^->\s*(.+)$")
SPEAKER_RE = re.compile(r"^([A-Za-z][\w '-]*):\s*(.*)$")


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" \t"))


def _split_blocks(text: str, warnings: list[str]) -> dict[str, list[tuple[int, str]]]:
    """Split the script into {title: [(indent, content), ...]} body lines."""
    raw_lines = text.splitlines()
    blocks: dict[str, list[tuple[int, str]]] = {}
    i = 0
    n = len(raw_lines)
    while i < n:
        stripped = raw_lines[i].strip()
        if not stripped:
            i += 1
            continue
        m = TITLE_RE.match(stripped)
        if not m:
            warnings.append(f"Line {i + 1}: expected `title:`, ignoring stray line {stripped!r}")
            i += 1
            continue
        title = m.group(1)
        i += 1
        while i < n and not BODY_START_RE.match(raw_lines[i].strip()):
            if raw_lines[i].strip():
                warnings.append(f"Line {i + 1}: ignoring node header {raw_lines[i].strip()!r}")
            i += 1
        i += 1  # past ---
        body: list[tuple[int, str]] = []
        while i < n and not BODY_END_RE.match(raw_lines[i].strip()):
            if raw_lines[i].strip():
                body.append((_indent(raw_lines[i]), raw_lines[i].strip()))
            i += 1
        i += 1  # past ===
        if title in blocks:
            warnings.append(f"Duplicate node title {title!r} in pasted script; keeping the first")
            continue
        blocks[title] = body
    return blocks


def _parse_condition(content: str, warnings: list[str]) -> dict | None:
    m = IF_RE.match(content)
    if not m:
        warnings.append(f"Unsupported condition, ignoring: {content!r}")
        return None
    negate, key, op, value = m.groups()
    if op is None:
        return {"type": "state_equals", "state_key": key, "value": not bool(negate)}
    if value is None:
        warnings.append(f"Condition is missing a value, ignoring: {content!r}")
        return None
    if op in (">=", ">"):
        return {"type": "stat_check", "state_key": key, "op": "at_least", "value": float(value)}
    if op in ("<", "<="):
        return {"type": "stat_check", "state_key": key, "op": "less_than", "value": float(value)}
    if value.lower() in ("true", "false"):
        return {"type": "state_equals", "state_key": key, "value": value.lower() == "true"}
    return {"type": "stat_check", "state_key": key, "op": "equals", "value": float(value)}


def _parse_set(content: str, warnings: list[str]) -> dict | None:
    m = SET_RE.match(content)
    if not m:
        warnings.append(f"Unsupported <<set>>, ignoring: {content!r}")
        return None
    key, value = m.groups()
    if value.lower() in ("true", "false"):
        return {"type": "set_flag", "state_key": key, "label": key, "value": value.lower() == "true"}
    warnings.append(
        f"Absolute numeric <<set $%s = %s>> isn't supported (our effects are relative changes) — skipping"
        % (key, value)
    )
    return None


def _parse_entries(lines: list[tuple[int, str]], warnings: list[str]) -> list[Entry]:
    entries: list[Entry] = []
    pending_condition: dict | None = None
    i, n = 0, len(lines)
    while i < n:
        indent, content = lines[i]
        if content.startswith("//"):
            i += 1
            continue
        if ENDIF_RE.match(content):
            pending_condition = None
            i += 1
            continue
        if IF_RE.match(content):
            pending_condition = _parse_condition(content, warnings)
            i += 1
            continue
        if JUMP_RE.match(content):
            entries.append(JumpEntry(target=JUMP_RE.match(content).group(1)))
            i += 1
            continue
        if content.startswith("<<set"):
            effect = _parse_set(content, warnings)
            if effect:
                entries.append(SetEntry(effect=effect))
            i += 1
            continue
        if content.startswith("<<"):
            warnings.append(f"Unsupported command, ignoring: {content!r}")
            i += 1
            continue
        m = OPTION_RE.match(content)
        if m:
            label = m.group(1).strip()
            nested: list[tuple[int, str]] = []
            j = i + 1
            while j < n and lines[j][0] > indent:
                nested.append(lines[j])
                j += 1
            body_entries = _parse_entries(nested, warnings)
            jump_target = None
            if len(body_entries) == 1 and isinstance(body_entries[0], JumpEntry):
                jump_target = body_entries[0].target
                body_entries = []
            entries.append(
                OptionEntry(label=label, requirement=pending_condition, jump_target=jump_target, body=body_entries)
            )
            pending_condition = None
            i = j
            continue
        sm = SPEAKER_RE.match(content)
        speaker, text = (sm.group(1), sm.group(2)) if sm else (None, content)
        entries.append(LineEntry(speaker=speaker, text=text))
        i += 1
    return entries


# --- Materialization ------------------------------------------------------------------------
def _resolve_character(project, name: str | None, cache: dict[str, int | None]) -> int | None:
    if not name:
        return None
    key = name.strip().lower()
    if key in cache:
        return cache[key]
    character_id = None
    if project is not None:
        character = Character.objects.filter(project=project, name__iexact=name).first()
        if character is None:
            character = Character.objects.create(project=project, name=name.strip())
        character_id = character.id
    cache[key] = character_id
    return character_id


@dataclass
class _Walk:
    scene: Scene
    project: object
    warnings: list[str]
    char_cache: dict[str, int | None] = field(default_factory=dict)
    title_to_node: dict[str, int] = field(default_factory=dict)
    deferred_edges: list[tuple[int, str, str, dict | None]] = field(default_factory=list)
    created_ids: list[int] = field(default_factory=list)

    def materialize_entries(self, entries: list[Entry], tail_id: int | None) -> int | None:
        pending_effects: list[dict] = []
        for entry in entries:
            if isinstance(entry, LineEntry):
                parent = Dialogue.objects.get(id=tail_id) if tail_id is not None else None
                node = Dialogue.create_node(
                    scene=self.scene,
                    parent=parent,
                    character_id=_resolve_character(self.project, entry.speaker, self.char_cache),
                    text=entry.text,
                    effects=pending_effects,
                )
                pending_effects = []
                self.created_ids.append(node.id)
                tail_id = node.id
            elif isinstance(entry, SetEntry):
                if tail_id is not None:
                    node = Dialogue.objects.get(id=tail_id)
                    node.effects = [*node.effects, entry.effect]
                    node.save(update_fields=["effects"])
                    node.sync_title_from_effects()
                else:
                    pending_effects.append(entry.effect)
            elif isinstance(entry, JumpEntry):
                if tail_id is None:
                    self.warnings.append(f"Jump to {entry.target!r} has no preceding line — skipping")
                    continue
                self.deferred_edges.append((tail_id, entry.target, "", None))
            elif isinstance(entry, OptionEntry):
                if tail_id is None:
                    stub = Dialogue.create_node(scene=self.scene, parent=None, text="")
                    self.created_ids.append(stub.id)
                    tail_id = stub.id
                if entry.jump_target is not None:
                    self.deferred_edges.append((tail_id, entry.jump_target, entry.label, entry.requirement))
                elif entry.body:
                    created_before = len(self.created_ids)
                    self.materialize_entries(entry.body, tail_id)
                    if len(self.created_ids) > created_before:
                        first_new_id = self.created_ids[created_before]
                        DialogueEdge.objects.filter(from_node_id=tail_id, to_node_id=first_new_id).update(
                            option_label=entry.label
                        )
                        if entry.requirement:
                            Dialogue.objects.filter(id=first_new_id).update(requirements=[entry.requirement])
                else:
                    self.warnings.append(f"Option {entry.label!r} has no destination — skipping")
        return tail_id

    def resolve_edges(self) -> None:
        for from_id, target_title, option_label, requirement in self.deferred_edges:
            target_id = self.title_to_node.get(target_title)
            if target_id is None:
                existing = Dialogue.objects.filter(title=target_title).first()
                if existing is None:
                    raise YarnImportError(
                        f"<<jump {target_title}>> doesn't match any pasted or existing node title",
                        warnings=self.warnings,
                    )
                target_id = existing.id
            from_node = Dialogue.objects.get(id=from_id)
            edge, created = DialogueEdge.objects.get_or_create(
                from_node_id=from_id,
                to_node_id=target_id,
                defaults={"order": from_node.outgoing_edges.count(), "option_label": option_label},
            )
            if not created and option_label and edge.option_label != option_label:
                edge.option_label = option_label
                edge.save(update_fields=["option_label"])
            if requirement:
                target = Dialogue.objects.get(id=target_id)
                if target.requirements:
                    self.warnings.append(
                        f"{target_title!r} already has requirements from another path; keeping the existing ones"
                    )
                else:
                    target.requirements = [requirement]
                    target.save(update_fields=["requirements"])


@transaction.atomic
def import_yarn(scene: Scene, text: str, parent_id: int | None = None) -> dict:
    """`parent_id`, if given, is an existing dialogue node — the first pasted node attaches to
    it as a new response (continuing that branch) instead of starting a fresh, disconnected
    root. Every other `title:` block in the paste is unaffected (still freestanding/jump-only)."""
    warnings: list[str] = []
    blocks = _split_blocks(text, warnings)
    if not blocks:
        raise YarnImportError("No `title: ... --- ... ===` node blocks found", warnings=warnings)

    parsed = {title: _parse_entries(lines, warnings) for title, lines in blocks.items()}
    project = scene.level.project if scene.level_id else None

    walk = _Walk(scene=scene, project=project, warnings=warnings)
    for index, (title, entries) in enumerate(parsed.items()):
        created_before = len(walk.created_ids)
        initial_tail = parent_id if index == 0 else None
        walk.materialize_entries(entries, initial_tail)
        if len(walk.created_ids) <= created_before:
            walk.warnings.append(f"Node {title!r} produced no content — skipping")
            continue
        walk.title_to_node[title] = walk.created_ids[created_before]

    walk.resolve_edges()

    # The first pasted node is a usable entry point, even if a loop-back jump elsewhere in the
    # script also targets it (so it wouldn't otherwise qualify as a "no incoming edges" root) —
    # unless it was attached to an existing node, in which case it's correctly not a root at all.
    first_title = next(iter(parsed), None)
    explicit_roots = (
        {walk.title_to_node[first_title]}
        if parent_id is None and first_title in walk.title_to_node
        else set()
    )
    root_ids = list(
        explicit_roots
        | set(
            Dialogue.objects.filter(id__in=walk.created_ids, incoming_edges__isnull=True).values_list(
                "id", flat=True
            )
        )
    )
    return {"created": len(walk.created_ids), "root_ids": root_ids, "warnings": walk.warnings}
