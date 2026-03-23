# -*- coding: utf-8 -*-
import json
import os
from typing import Any

from app.database import get_session_local
from app.models.ai_api_cost_event import AIAPICostEvent


MODEL_PRICE_DEFAULTS = {
    "claude-sonnet-4-6": {
        "input_per_million": 3.0,
        "output_per_million": 15.0,
        "cache_write_per_million": 3.75,
        "cache_read_per_million": 0.3,
    },
    "claude-haiku-4-5-20251001": {
        "input_per_million": 0.8,
        "output_per_million": 4.0,
        "cache_write_per_million": 1.0,
        "cache_read_per_million": 0.08,
    },
}


def _get_model_prices(model: str) -> dict[str, float]:
    env_key = model.upper().replace("-", "_")
    defaults = MODEL_PRICE_DEFAULTS.get(model, MODEL_PRICE_DEFAULTS["claude-sonnet-4-6"])
    return {
        "input_per_million": float(os.getenv(f"AI_COST_{env_key}_INPUT_PER_MILLION", str(defaults["input_per_million"]))),
        "output_per_million": float(os.getenv(f"AI_COST_{env_key}_OUTPUT_PER_MILLION", str(defaults["output_per_million"]))),
        "cache_write_per_million": float(os.getenv(f"AI_COST_{env_key}_CACHE_WRITE_PER_MILLION", str(defaults["cache_write_per_million"]))),
        "cache_read_per_million": float(os.getenv(f"AI_COST_{env_key}_CACHE_READ_PER_MILLION", str(defaults["cache_read_per_million"]))),
    }


def _extract_usage_metrics(usage: Any) -> dict[str, int]:
    if not usage:
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
        }

    return {
        "input_tokens": int(getattr(usage, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(usage, "output_tokens", 0) or 0),
        "cache_creation_input_tokens": int(getattr(usage, "cache_creation_input_tokens", 0) or 0),
        "cache_read_input_tokens": int(getattr(usage, "cache_read_input_tokens", 0) or 0),
    }


def estimate_anthropic_cost_usd(model: str, usage: Any) -> tuple[float, dict[str, int]]:
    metrics = _extract_usage_metrics(usage)
    prices = _get_model_prices(model)

    estimated = (
        (metrics["input_tokens"] / 1_000_000) * prices["input_per_million"] +
        (metrics["output_tokens"] / 1_000_000) * prices["output_per_million"] +
        (metrics["cache_creation_input_tokens"] / 1_000_000) * prices["cache_write_per_million"] +
        (metrics["cache_read_input_tokens"] / 1_000_000) * prices["cache_read_per_million"]
    )
    return round(estimated, 6), metrics


def record_ai_api_cost(
    *,
    user_id: int | None,
    feature: str,
    model: str,
    usage: Any,
    request_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return

    estimated_cost_usd, metrics = estimate_anthropic_cost_usd(model, usage)
    db = SessionLocal()
    try:
        db.add(AIAPICostEvent(
            user_id=user_id,
            feature=feature,
            model=model,
            request_id=request_id,
            input_tokens=metrics["input_tokens"],
            output_tokens=metrics["output_tokens"],
            cache_creation_input_tokens=metrics["cache_creation_input_tokens"],
            cache_read_input_tokens=metrics["cache_read_input_tokens"],
            estimated_cost_usd=estimated_cost_usd,
            metadata_json=json.dumps(metadata or {}, ensure_ascii=False) if metadata else None,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[AI_COST] Error registrando coste estimado: {exc}")
    finally:
        db.close()
