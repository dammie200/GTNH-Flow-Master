"""Domain logic for computing GTNH production plans."""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

from pydantic import BaseModel, Field, ValidationError, field_validator

from .flow_engine import FlowEngine, FlowValidationError


class ProductionError(ValueError):
    """Raised when a production plan cannot be calculated."""

    def __init__(self, message: str, *, details: Optional[List[str]] = None) -> None:
        super().__init__(message)
        self.details = details or []

    def as_dict(self) -> Dict[str, object]:
        return {"message": str(self), "details": self.details}


class IngredientModel(BaseModel):
    """Single ingredient used as an input or produced as an output."""

    item: str = Field(..., description="Naam van het item.")
    amount: float = Field(..., description="Hoeveelheid per craft.")

    @field_validator("item")
    @classmethod
    def _ensure_item(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            msg = "Itemnaam mag niet leeg zijn."
            raise ValueError(msg)
        return cleaned

    @field_validator("amount")
    @classmethod
    def _ensure_amount(cls, value: float) -> float:
        if value <= 0:
            msg = "Hoeveelheden moeten groter zijn dan nul."
            raise ValueError(msg)
        return value


GT_VOLTAGES: Dict[str, int] = {
    "ULV": 8,
    "LV": 32,
    "MV": 128,
    "HV": 512,
    "EV": 2048,
    "IV": 8192,
    "LUV": 32768,
    "ZPM": 131072,
    "UV": 524288,
    "UHV": 2097152,
    "UEV": 8388608,
    "UIV": 33554432,
    "UMV": 134217728,
    "UXV": 536870912,
}


def normalise_tier(tier: str) -> str:
    """Return the canonical representation for a tier string."""

    return tier.strip().upper()


class RecipeModel(BaseModel):
    """Beschrijving van een machine recept."""

    identifier: str = Field(..., alias="id", description="Unieke sleutel voor de machine.")
    machine: str = Field(..., description="Naam van de machine.")
    tier: str = Field(..., description="Tier of energieniveau van de machine.")
    coils: Optional[str] = Field(default=None, description="Coilspecificatie indien van toepassing.")
    heat: Optional[int] = Field(default=None, description="Warmtevereiste voor Pyro/EBF.")
    eu_per_tick: float = Field(..., description="EU per tick.")
    duration: float = Field(..., description="Duur per craft (seconden).")
    inputs: List[IngredientModel] = Field(default_factory=list)
    outputs: List[IngredientModel] = Field(default_factory=list)

    @field_validator("identifier")
    @classmethod
    def _ensure_identifier(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            msg = "Machine-ID mag niet leeg zijn."
            raise ValueError(msg)
        return cleaned

    @field_validator("machine")
    @classmethod
    def _ensure_machine(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            msg = "Machine naam mag niet leeg zijn."
            raise ValueError(msg)
        return cleaned

    @field_validator("tier")
    @classmethod
    def _ensure_tier(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            msg = "Tier mag niet leeg zijn."
            raise ValueError(msg)
        return cleaned

    @field_validator("eu_per_tick")
    @classmethod
    def _ensure_eu(cls, value: float) -> float:
        if value <= 0:
            msg = "EU/t moet groter zijn dan nul."
            raise ValueError(msg)
        return value

    @field_validator("duration")
    @classmethod
    def _ensure_duration(cls, value: float) -> float:
        if value <= 0:
            msg = "Duur moet groter zijn dan nul."
            raise ValueError(msg)
        return value

    @field_validator("outputs")
    @classmethod
    def _ensure_outputs(cls, value: List[IngredientModel]) -> List[IngredientModel]:
        if not value:
            msg = "Een recept moet minstens één output bevatten."
            raise ValueError(msg)
        return value

    def get_output(self, item: str) -> IngredientModel:
        for ingredient in self.outputs:
            if ingredient.item.lower() == item.lower():
                return ingredient
        msg = f"Recept '{self.identifier}' produceert geen item '{item}'."
        raise ProductionError(msg)


class PlanRequestModel(BaseModel):
    """Payload ontvangen van de frontend."""

    target_item: str = Field(..., description="Gewenste output.")
    target_amount: float = Field(..., description="Hoeveelheid van de target.")
    recipes: List[RecipeModel] = Field(default_factory=list)

    @field_validator("target_item")
    @classmethod
    def _ensure_target(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            msg = "Target item mag niet leeg zijn."
            raise ValueError(msg)
        return cleaned

    @field_validator("target_amount")
    @classmethod
    def _ensure_target_amount(cls, value: float) -> float:
        if value <= 0:
            msg = "Target hoeveelheid moet groter zijn dan nul."
            raise ValueError(msg)
        return value

    @field_validator("recipes")
    @classmethod
    def _ensure_recipes(cls, value: List[RecipeModel]) -> List[RecipeModel]:
        if not value:
            msg = "Voeg minstens één recept toe."
            raise ValueError(msg)
        return value


@dataclass
class IngredientAmount:
    item: str
    amount: float


@dataclass
class MachineSummary:
    recipe: RecipeModel
    crafts: float
    inputs: List[IngredientAmount]
    outputs: List[IngredientAmount]

    @property
    def eu_total(self) -> float:
        return self.crafts * self.recipe.eu_per_tick * self.recipe.duration * 20

    @property
    def machines_required(self) -> float:
        return self.crafts

    @property
    def active_seconds(self) -> float:
        return self.crafts * self.recipe.duration

    @property
    def tier_key(self) -> str:
        return normalise_tier(self.recipe.tier)

    @property
    def tier_voltage(self) -> Optional[int]:
        key = self.tier_key
        return GT_VOLTAGES.get(key)

    @property
    def average_eu_per_tick(self) -> float:
        return self.recipe.eu_per_tick * self.machines_required

    @property
    def peak_eu_per_tick(self) -> float:
        return math.ceil(self.machines_required) * self.recipe.eu_per_tick

    @property
    def average_amperage(self) -> Optional[float]:
        voltage = self.tier_voltage
        if voltage is None:
            return None
        return self.average_eu_per_tick / voltage

    @property
    def peak_amperage(self) -> Optional[float]:
        voltage = self.tier_voltage
        if voltage is None:
            return None
        return self.peak_eu_per_tick / voltage


@dataclass
class PlanData:
    target_item: str
    target_amount: float
    machines: List[MachineSummary]
    raw_inputs: Dict[str, float]
    byproducts: Dict[str, float]
    produced: Dict[str, float]
    demanded: Dict[str, float]

    def to_dict(self) -> Dict[str, object]:
        energy_summary = self._build_energy_summary()
        return {
            "target": {
                "item": self.target_item,
                "amount": self.target_amount,
            },
            "machines": [
                {
                    "id": summary.recipe.identifier,
                    "machine": summary.recipe.machine,
                    "tier": summary.recipe.tier,
                    "coils": summary.recipe.coils,
                    "heat": summary.recipe.heat,
                    "eu_per_tick": summary.recipe.eu_per_tick,
                    "duration": summary.recipe.duration,
                    "crafts": summary.crafts,
                    "eu_total": summary.eu_total,
                    "machines_required": summary.machines_required,
                    "active_seconds": summary.active_seconds,
                    "average_eu_per_tick": summary.average_eu_per_tick,
                    "peak_eu_per_tick": summary.peak_eu_per_tick,
                    "average_amperage": summary.average_amperage,
                    "peak_amperage": summary.peak_amperage,
                    "inputs": [
                        {"item": ingredient.item, "amount": ingredient.amount}
                        for ingredient in summary.inputs
                    ],
                    "outputs": [
                        {"item": ingredient.item, "amount": ingredient.amount}
                        for ingredient in summary.outputs
                    ],
                }
                for summary in self.machines
            ],
            "raw_inputs": [
                {"item": item, "amount": amount}
                for item, amount in sorted(self.raw_inputs.items())
            ],
            "byproducts": [
                {"item": item, "amount": amount}
                for item, amount in sorted(self.byproducts.items())
            ],
            "produced": [
                {"item": item, "amount": amount}
                for item, amount in sorted(self.produced.items())
            ],
            "energy": energy_summary,
        }

    def _build_energy_summary(self) -> Dict[str, object]:
        tier_data: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        total_active_seconds = 0.0
        total_average_eu = 0.0
        total_peak_eu = 0.0

        for summary in self.machines:
            tier_key = summary.tier_key
            data = tier_data[tier_key]
            data["machines_required"] += summary.machines_required
            data["average_eu_per_tick"] += summary.average_eu_per_tick
            data["peak_eu_per_tick"] += summary.peak_eu_per_tick
            total_active_seconds += summary.active_seconds
            total_average_eu += summary.average_eu_per_tick
            total_peak_eu += summary.peak_eu_per_tick

        tier_rows: List[Dict[str, object]] = []
        total_average_amps = 0.0
        total_peak_amps = 0.0

        for tier_key, data in sorted(tier_data.items()):
            voltage = GT_VOLTAGES.get(tier_key)
            average_amps = None
            peak_amps = None
            if voltage is not None:
                average_amps = data["average_eu_per_tick"] / voltage
                peak_amps = data["peak_eu_per_tick"] / voltage
                total_average_amps += average_amps
                total_peak_amps += peak_amps

            tier_rows.append(
                {
                    "tier": tier_key,
                    "voltage": voltage,
                    "machines_required": data["machines_required"],
                    "average_eu_per_tick": data["average_eu_per_tick"],
                    "peak_eu_per_tick": data["peak_eu_per_tick"],
                    "average_amperage": average_amps,
                    "peak_amperage": peak_amps,
                }
            )

        return {
            "total_active_seconds": total_active_seconds,
            "average_eu_per_tick": total_average_eu,
            "peak_eu_per_tick": total_peak_eu,
            "average_amperage": total_average_amps if total_average_amps else None,
            "peak_amperage": total_peak_amps if total_peak_amps else None,
            "tiers": tier_rows,
        }


class PlanBuilder:
    """Bereken de benodigde machines voor een target."""

    def __init__(self, recipes: Iterable[RecipeModel]) -> None:
        self.recipes = list(recipes)
        self.recipe_by_item: Dict[str, RecipeModel] = {}
        for recipe in self.recipes:
            for output in recipe.outputs:
                key = output.item.lower()
                if key in self.recipe_by_item:
                    other = self.recipe_by_item[key]
                    msg = (
                        "Meerdere recepten produceren hetzelfde item. "
                        f"'{output.item}' komt voor in '{other.identifier}' en '{recipe.identifier}'."
                    )
                    raise ProductionError(msg)
                self.recipe_by_item[key] = recipe

        self.raw_inputs: Dict[str, float] = defaultdict(float)
        self.produced: Dict[str, float] = defaultdict(float)
        self.demanded: Dict[str, float] = defaultdict(float)
        self.recipe_usage: Dict[str, float] = defaultdict(float)
        self.recipe_inputs: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        self.recipe_outputs: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    def build(self, target_item: str, target_amount: float) -> PlanData:
        if target_item.lower() not in self.recipe_by_item:
            msg = f"Geen recept gevonden dat '{target_item}' produceert."
            raise ProductionError(msg)
        self._produce(target_item, target_amount, stack=tuple())

        machines: List[MachineSummary] = []
        for recipe in self.recipes:
            crafts = self.recipe_usage.get(recipe.identifier, 0.0)
            if crafts <= 0:
                continue
            inputs = [
                IngredientAmount(item=item, amount=amount)
                for item, amount in sorted(self.recipe_inputs[recipe.identifier].items())
            ]
            outputs = [
                IngredientAmount(item=item, amount=amount)
                for item, amount in sorted(self.recipe_outputs[recipe.identifier].items())
            ]
            machines.append(MachineSummary(recipe=recipe, crafts=crafts, inputs=inputs, outputs=outputs))

        byproducts: Dict[str, float] = {}
        for item, produced in self.produced.items():
            demand = self.demanded.get(item, 0.0)
            excess = produced - demand
            if excess > 1e-9:
                byproducts[item] = excess

        return PlanData(
            target_item=target_item,
            target_amount=target_amount,
            machines=machines,
            raw_inputs=dict(self.raw_inputs),
            byproducts=byproducts,
            produced=dict(self.produced),
            demanded=dict(self.demanded),
        )

    def _produce(self, item: str, amount: float, *, stack: Tuple[str, ...]) -> None:
        key = item.lower()
        self.demanded[item] += amount
        if key not in self.recipe_by_item:
            self.raw_inputs[item] += amount
            return

        if item in stack:
            chain = " -> ".join(stack + (item,))
            raise ProductionError(f"Cyclische afhankelijkheid gevonden: {chain}")

        recipe = self.recipe_by_item[key]
        output = recipe.get_output(item)
        crafts = amount / output.amount
        self.recipe_usage[recipe.identifier] += crafts

        for out in recipe.outputs:
            total_out = crafts * out.amount
            self.produced[out.item] += total_out
            self.recipe_outputs[recipe.identifier][out.item] += total_out

        for ing in recipe.inputs:
            required = crafts * ing.amount
            self.recipe_inputs[recipe.identifier][ing.item] += required
            self._produce(ing.item, required, stack=stack + (item,))


class ProductionEngine:
    """Coördineert validatie en flow-generatie voor productieplannen."""

    def __init__(self, flow_engine: Optional[FlowEngine] = None) -> None:
        self._flow_engine = flow_engine or FlowEngine()

    def generate_plan(self, payload: Dict[str, object]) -> Tuple[PlanData, str, Dict[str, str]]:
        try:
            request = PlanRequestModel.model_validate(payload)
        except ValidationError as exc:
            details = [error["msg"] for error in exc.errors()]
            raise ProductionError("Ongeldige invoer voor productieplan.", details=details) from exc

        builder = PlanBuilder(request.recipes)
        plan = builder.build(request.target_item, request.target_amount)

        flow_payload = self._create_flow_payload(plan)
        try:
            compiled = self._flow_engine.compile(flow_payload)
        except FlowValidationError as exc:  # pragma: no cover - defensive
            raise ProductionError(str(exc), details=exc.details) from exc

        return plan, compiled.mermaid, compiled.notes

    def _create_flow_payload(self, plan: PlanData) -> Dict[str, object]:
        nodes: List[Dict[str, object]] = []
        edges: List[Dict[str, object]] = []

        item_keys: Dict[str, str] = {}

        def ensure_item_node(item: str, amount: float, kind: str) -> str:
            key = item_keys.get(item)
            if key:
                return key
            label_amount = self._format_amount(amount)
            label = f"{item}\n{label_amount}"
            node = {
                "key": f"item::{item}",
                "label": label,
                "kind": kind,
                "note": f"Totale hoeveelheid: {label_amount}",
            }
            nodes.append(node)
            item_keys[item] = node["key"]
            return node["key"]

        raw_keys = {item for item in plan.raw_inputs}

        for item, amount in sorted(plan.demanded.items()):
            if item == plan.target_item:
                kind = "output"
            elif item in raw_keys:
                kind = "input"
            else:
                kind = "data"
            ensure_item_node(item, amount, kind)

        for summary in plan.machines:
            note_parts = [
                f"Machine: {summary.recipe.machine}",
                f"Tier: {summary.recipe.tier}",
                f"Machines nodig: {self._format_amount(summary.machines_required)}",
                f"Crafts: {self._format_amount(summary.crafts)}",
                f"Duur per craft: {self._format_amount(summary.recipe.duration)} s",
                f"Actieve tijd: {self._format_amount(summary.active_seconds)} s",
                f"EU/t: {self._format_amount(summary.recipe.eu_per_tick)}",
                f"Gemiddelde EU/t: {self._format_amount(summary.average_eu_per_tick)}",
                f"Piek EU/t: {self._format_amount(summary.peak_eu_per_tick)}",
                f"Totale EU: {self._format_amount(summary.eu_total)}",
            ]
            if summary.recipe.coils:
                note_parts.append(f"Coils: {summary.recipe.coils}")
            if summary.recipe.heat is not None:
                note_parts.append(f"Warmte: {summary.recipe.heat}")

            label = (
                f"{self._format_amount(summary.machines_required)}× {summary.recipe.tier} "
                f"{summary.recipe.machine}"
            )
            node = {
                "key": f"recipe::{summary.recipe.identifier}",
                "label": label,
                "kind": "process",
                "note": "\n".join(note_parts),
            }
            nodes.append(node)

            for ingredient in summary.inputs:
                item_key = ensure_item_node(ingredient.item, plan.demanded.get(ingredient.item, ingredient.amount), "input")
                edges.append(
                    {
                        "source": item_key,
                        "target": node["key"],
                        "label": self._format_amount(ingredient.amount),
                    }
                )

            for product in summary.outputs:
                amount = plan.produced.get(product.item, product.amount)
                item_key = ensure_item_node(product.item, amount, "output")
                edges.append(
                    {
                        "source": node["key"],
                        "target": item_key,
                        "label": self._format_amount(product.amount),
                    }
                )

        return {
            "title": f"Plan voor {plan.target_item}",
            "orientation": "LR",
            "nodes": nodes,
            "edges": edges,
        }

    def _format_amount(self, value: float) -> str:
        if abs(value) < 1e-6:
            return "0"
        if abs(value) >= 100:
            return f"{value:,.0f}".replace(",", " ")
        return f"{value:.3f}".rstrip("0").rstrip(".")


__all__ = ["ProductionEngine", "ProductionError"]

