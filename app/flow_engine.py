"""Utilities for validating flow inputs and generating Mermaid diagrams."""
from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator


class FlowValidationError(ValueError):
    """Raised when a flow definition is invalid."""

    def __init__(self, message: str, *, details: Optional[List[str]] = None) -> None:
        super().__init__(message)
        self.details = details or []

    def as_dict(self) -> Dict[str, object]:
        return {"message": str(self), "details": self.details}


class NodeModel(BaseModel):
    """Representation of a node in the flow graph."""

    key: str = Field(..., description="Identifier used to reference the node.")
    label: str = Field(..., description="User facing label for the node.")
    kind: str = Field(
        default="process",
        description="Visual template for the node. Options: process, decision, terminator, data, input, output.",
    )
    note: str = Field(default="", description="Additional information shown when the node is clicked.")

    @field_validator("key")
    @classmethod
    def _ensure_key(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            msg = "Node key may not be empty."
            raise ValueError(msg)
        return cleaned

    @field_validator("label")
    @classmethod
    def _ensure_label(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            msg = "Node label may not be empty."
            raise ValueError(msg)
        return cleaned

    @field_validator("kind")
    @classmethod
    def _normalise_kind(cls, value: str) -> str:
        cleaned = value.strip().lower()
        allowed = {"process", "decision", "terminator", "data", "input", "output"}
        if cleaned not in allowed:
            msg = f"Unsupported node type '{value}'. Allowed values: {', '.join(sorted(allowed))}."
            raise ValueError(msg)
        return cleaned


class EdgeModel(BaseModel):
    """Representation of a relationship between two nodes."""

    source: str = Field(..., description="Key of the source node.")
    target: str = Field(..., description="Key of the target node.")
    label: str = Field(default="", description="Optional label for the connection.")
    style: str = Field(
        default="solid",
        description="Visual style for the edge line. Options: solid, dashed, thick.",
    )
    direction: str = Field(
        default="forward",
        description="Direction of the connection. Options: forward, backward, bidirectional, none.",
    )

    @model_validator(mode="after")
    def _validate_nodes(self) -> "EdgeModel":
        if self.source == self.target:
            msg = "Edges must connect two distinct nodes."
            raise ValueError(msg)
        return self

    @field_validator("style")
    @classmethod
    def _normalise_style(cls, value: str) -> str:
        cleaned = value.strip().lower()
        allowed = {"solid", "dashed", "thick"}
        if cleaned not in allowed:
            msg = f"Unsupported edge style '{value}'. Allowed: {', '.join(sorted(allowed))}."
            raise ValueError(msg)
        return cleaned

    @field_validator("direction")
    @classmethod
    def _normalise_direction(cls, value: str) -> str:
        cleaned = value.strip().lower()
        allowed = {"forward", "backward", "bidirectional", "none"}
        if cleaned not in allowed:
            msg = f"Unsupported edge direction '{value}'. Allowed: {', '.join(sorted(allowed))}."
            raise ValueError(msg)
        return cleaned


class FlowModel(BaseModel):
    """Complete flow definition."""

    title: str = Field(default="Unnamed flow")
    orientation: str = Field(
        default="TD", description="Flow orientation. Options: TD, LR, BT, RL."
    )
    nodes: List[NodeModel] = Field(default_factory=list)
    edges: List[EdgeModel] = Field(default_factory=list)

    @field_validator("orientation")
    @classmethod
    def _normalise_orientation(cls, value: str) -> str:
        cleaned = value.strip().upper()
        allowed = {"TD", "LR", "BT", "RL"}
        if cleaned not in allowed:
            msg = f"Unsupported orientation '{value}'. Allowed: {', '.join(sorted(allowed))}."
            raise ValueError(msg)
        return cleaned

    @model_validator(mode="after")
    def _validate_references(self) -> "FlowModel":
        node_keys = {node.key for node in self.nodes}
        missing: List[str] = []
        for edge in self.edges:
            if edge.source not in node_keys:
                missing.append(f"Unknown source node '{edge.source}'")
            if edge.target not in node_keys:
                missing.append(f"Unknown target node '{edge.target}'")
        if missing:
            raise ValueError("; ".join(sorted(set(missing))))
        return self


@dataclass
class CompiledFlow:
    """Result returned by the flow compiler."""

    mermaid: str
    notes: Dict[str, str]
    node_mapping: Dict[str, str]


class FlowEngine:
    """Validate flow definitions and compile them into Mermaid diagrams."""

    NODE_TEMPLATES: Dict[str, str] = {
        "process": "[{label}]",
        "decision": "{{{label}}}",
        "terminator": "([{label}])",
        "data": "[(" + "{label}" + ")]",  # rounded rectangle with double borders
        "input": "[[{label}]]",
        "output": "[[{label}]]",
    }

    EDGE_TEMPLATES: Dict[str, Dict[str, str]] = {
        "solid": {"forward": "-->", "bidirectional": "<-->", "none": "---"},
        "dashed": {"forward": "-.->", "bidirectional": "<-.->", "none": "-.-"},
        "thick": {"forward": "==>", "bidirectional": "<==>", "none": "==="},
    }

    _SANITISE_PATTERN = re.compile(r"[^0-9a-zA-Z_]")

    def compile(self, payload: Dict[str, object]) -> CompiledFlow:
        try:
            flow = FlowModel.model_validate(payload)
        except ValidationError as exc:  # pragma: no cover - defensive branch
            details = [err["msg"] for err in exc.errors()]
            raise FlowValidationError("Flow definition is invalid.", details=details) from exc
        except ValueError as exc:
            raise FlowValidationError(str(exc)) from exc

        node_mapping = self._build_node_mapping(flow.nodes)
        lines: List[str] = [f"flowchart {flow.orientation}"]
        notes: Dict[str, str] = {}

        for node in flow.nodes:
            node_id = node_mapping[node.key]
            label = self._escape_label(node.label)
            template = self.NODE_TEMPLATES.get(node.kind, self.NODE_TEMPLATES["process"])
            lines.append(f"    {node_id}{template.format(label=label)}")
            if node.note:
                notes[node_id] = node.note

        for edge in flow.edges:
            source = node_mapping[edge.source]
            target = node_mapping[edge.target]
            direction = edge.direction
            style_templates = self.EDGE_TEMPLATES.get(edge.style, self.EDGE_TEMPLATES["solid"])
            template_key = direction if direction in style_templates else "forward"
            arrow = style_templates.get(template_key, "-->")
            if direction == "backward":
                # Reverse the connection to keep arrow semantics predictable for Mermaid.
                source, target = target, source
            label = edge.label.strip()
            if label:
                escaped_label = self._escape_label(label)
                lines.append(f"    {source} {arrow}|{escaped_label}| {target}")
            else:
                lines.append(f"    {source} {arrow} {target}")

        for node_id in notes:
            lines.append(f'    click {node_id} call flowNote("{node_id}")')

        mermaid_definition = "\n".join(lines)
        return CompiledFlow(mermaid=mermaid_definition, notes=notes, node_mapping=node_mapping)

    def _build_node_mapping(self, nodes: List[NodeModel]) -> Dict[str, str]:
        mapping: Dict[str, str] = {}
        used_ids: Dict[str, int] = {}
        for index, node in enumerate(nodes, start=1):
            candidate = self._sanitise_key(node.key)
            if not candidate:
                candidate = f"node_{index}"
            unique = self._ensure_unique(candidate, used_ids)
            mapping[node.key] = unique
        return mapping

    def _sanitise_key(self, key: str) -> str:
        cleaned = self._SANITISE_PATTERN.sub("_", key.strip())
        return cleaned.strip("_")

    def _ensure_unique(self, base: str, used: Dict[str, int]) -> str:
        if base not in used:
            used[base] = 1
            return base
        used[base] += 1
        return f"{base}_{used[base]}"

    def _escape_label(self, label: str) -> str:
        label = label.replace("\n", "<br/>")
        label = label.replace("|", "&#124;")
        return label.replace("\"", "\\\"")


__all__ = [
    "FlowEngine",
    "FlowValidationError",
]
