"""Application factory for the GTNH Flow Master web tool."""
from __future__ import annotations

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

    return app
