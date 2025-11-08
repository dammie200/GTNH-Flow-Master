"""Application factory for the GTNH Flow Master web tool."""
from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from .flow_engine import FlowEngine, FlowValidationError


def create_app() -> Flask:
    """Create and configure the Flask application."""

    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )

    engine = FlowEngine()

    @app.get("/")
    def index():  # type: ignore[override]
        """Render the main UI."""

        return render_template("index.html")  # pragma: no cover - wrapper

    @app.post("/api/mermaid")
    def generate_mermaid():  # type: ignore[override]
        """Compile the flow definition sent from the UI into Mermaid syntax."""

        payload = request.get_json(silent=True) or {}
        try:
            compiled = engine.compile(payload)  # type: ignore[arg-type]
        except FlowValidationError as exc:
            response = {"error": exc.as_dict()}
            return jsonify(response), 400
        return jsonify({"mermaid": compiled.mermaid, "notes": compiled.notes})

    return app
