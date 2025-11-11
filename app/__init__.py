"""Application factory for the GTNH Flow Master web tool."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List

from flask import Flask, jsonify, render_template, request

from .flow_engine import FlowEngine, FlowValidationError
from .production_engine import ProductionEngine, ProductionError


def create_app() -> Flask:
    """Create and configure the Flask application."""

    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )

    flow_engine = FlowEngine()
    production_engine = ProductionEngine(flow_engine)

    catalog: List[dict[str, Any]] = []
    catalog_path = Path(app.root_path) / "data" / "gregtech_recipes.json"
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        catalog = []

    @app.get("/")
    def index():  # type: ignore[override]
        """Render the main UI."""

        return render_template("index.html")  # pragma: no cover - wrapper

    @app.post("/api/mermaid")
    def generate_mermaid():  # type: ignore[override]
        """Compile the flow definition sent from the UI into Mermaid syntax."""

        payload = request.get_json(silent=True) or {}
        try:
            compiled = flow_engine.compile(payload)  # type: ignore[arg-type]
        except FlowValidationError as exc:
            response = {"error": exc.as_dict()}
            return jsonify(response), 400
        return jsonify({"mermaid": compiled.mermaid, "notes": compiled.notes})

    @app.post("/api/plan")
    def generate_plan():  # type: ignore[override]
        """Calculate a production plan and return diagram + metadata."""

        payload = request.get_json(silent=True) or {}
        try:
            plan, mermaid, notes = production_engine.generate_plan(payload)
        except ProductionError as exc:
            response = {"error": exc.as_dict()}
            return jsonify(response), 400
        return jsonify({
            "mermaid": mermaid,
            "notes": notes,
            "plan": plan.to_dict(),
        })

    @app.get("/api/gregtech/recipes")
    def list_gregtech_recipes():  # type: ignore[override]
        """Return the built-in GregTech recipe catalogue."""

        return jsonify({"recipes": catalog})

    return app
