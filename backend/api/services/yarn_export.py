"""Export a scene's dialogue graph back out as a Yarn script.

The inverse of `yarn_import.py` — and much less lossy, since our model (nodes plus typed
requirements/effects) is already a bounded subset of what Yarn can express. Straight,
unbranched chains of dialogue (a node reached from exactly one place, whose sole predecessor
has no other responses) collapse into a single Yarn node's consecutive lines — a new `title:`
block starts only at genuine decision points (a node offered as one of several responses) or
convergence points (a node reachable from more than one place). Those are always referenced by
the dialogue's own stable `title` via a real `<<jump>>`, never inlined, so the output stays
simple and mechanical to verify, and every node appears in the output exactly once.

`has_item`/`stat_check`/`state_equals` requirements become a single `<<if>>` (multiple
requirements on one node are ANDed into one expression), wrapped with a matching `<<endif>>`
per real Yarn's syntax. `set_flag`/`give_item`/`remove_item`/`remember_choice`/`change_stat`
effects become `<<set>>` — `change_stat` uses Yarn's arithmetic (`<<set $x = $x + N>>`) since
it's a relative change, not an assignment.

Deliberately NOT emitted: `<<declare $var = ...>>` headers. We have the info (`Project.
state_schema`), but scenes commonly share state keys (e.g. a flag set in one scene and read in
another), and declaring the same variable twice across multiple files loaded into one Yarn
Spinner project is a compile error. A shared "export this project's variables once" file is a
reasonable follow-up; per-scene export skips declares to avoid that footgun.
"""
from __future__ import annotations

from ..models import Dialogue, Scene


def _format_number(value) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _yarn_literal(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return _format_number(value)
    return f'"{value}"'


def _condition_expr(requirement: dict) -> str:
    key = requirement.get("state_key", "")
    kind = requirement.get("type")
    if kind == "has_item":
        return f"${key}"
    if kind == "stat_check":
        op = {"at_least": ">=", "less_than": "<", "equals": "=="}.get(requirement.get("op"), "==")
        return f"${key} {op} {_format_number(requirement.get('value'))}"
    # state_equals — covers plain flag checks and remembered-choice checks alike.
    value = requirement.get("value")
    if value is True:
        return f"${key}"
    if value is False:
        return f"!${key}"
    return f"${key} == {_yarn_literal(value)}"


def _effect_lines(effect: dict) -> list[str]:
    kind = effect.get("type")
    key = effect.get("state_key", "")
    if kind == "set_flag":
        return [f"<<set ${key} = {_yarn_literal(bool(effect.get('value')))}>>"]
    if kind in ("remember_choice", "give_item"):
        return [f"<<set ${key} = true>>"]
    if kind == "remove_item":
        return [f"<<set ${key} = false>>"]
    if kind == "change_stat":
        amount = effect.get("amount", 0)
        op = "+" if amount >= 0 else "-"
        return [f"<<set ${key} = ${key} {op} {abs(amount)}>>"]
    return []


def _clean_text(text: str) -> str:
    return " ".join((text or "").splitlines()).strip()


def _line_for(node: Dialogue) -> str:
    text = _clean_text(node.text)
    if node.character_id and node.character:
        return f"{node.character.name}: {text}"
    return text


def export_scene_to_yarn(scene: Scene) -> str:
    nodes = list(
        Dialogue.objects.filter(scene=scene)
        .select_related("character")
        .prefetch_related("outgoing_edges__to_node", "incoming_edges")
    )
    if not nodes:
        return ""

    by_id = {n.id: n for n in nodes}
    indegree = {n.id: len(n.incoming_edges.all()) for n in nodes}
    outdegree = {n.id: len(n.outgoing_edges.all()) for n in nodes}
    sole_parent_outdegree: dict[int, int] = {}
    for n in nodes:
        if indegree[n.id] == 1:
            parent_id = n.incoming_edges.all()[0].from_node_id
            sole_parent_outdegree[n.id] = outdegree.get(parent_id, 0)

    def is_block_start(node_id: int) -> bool:
        if indegree[node_id] != 1:
            return True
        return sole_parent_outdegree.get(node_id, 0) != 1

    def render_block(start: Dialogue) -> tuple[str, set[int]]:
        lines: list[str] = []
        visited_here = {start.id}
        node = start
        while True:
            lines.append(_line_for(node))
            for effect in node.effects or []:
                lines.extend(_effect_lines(effect))
            edges = list(node.outgoing_edges.all())
            if not edges:
                break
            if len(edges) == 1 and edges[0].to_node_id not in visited_here and not is_block_start(
                edges[0].to_node_id
            ):
                node = by_id[edges[0].to_node_id]
                visited_here.add(node.id)
                continue
            for edge in edges:
                target = by_id[edge.to_node_id]
                label = edge.option_label or _clean_text(target.text) or target.title
                condition = " and ".join(_condition_expr(r) for r in (target.requirements or []))
                if condition:
                    lines.append(f"<<if {condition}>>")
                lines.append(f"-> {label}")
                lines.append(f"    <<jump {target.title}>>")
                if condition:
                    lines.append("<<endif>>")
            break
        return f"title: {start.title}\n---\n" + "\n".join(lines) + "\n===", visited_here

    blocks: list[str] = []
    emitted: set[int] = set()
    for start in [n for n in nodes if is_block_start(n.id)]:
        text, visited_here = render_block(start)
        blocks.append(text)
        emitted |= visited_here

    # Safety net: nodes that never got visited are isolated cycles with no external entry point
    # (every node in them has exactly one parent and one child, so none qualified as a block
    # start). Rather than silently dropping that content, force one member of each such loop to
    # be an entry point — `render_block`'s visited-set guard keeps this from looping forever.
    remaining = [n for n in nodes if n.id not in emitted]
    while remaining:
        start = remaining[0]
        text, visited_here = render_block(start)
        blocks.append(text)
        emitted |= visited_here
        remaining = [n for n in nodes if n.id not in emitted]

    return "\n\n".join(blocks) + "\n"
