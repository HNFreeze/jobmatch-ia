# -*- coding: utf-8 -*-
"""Personal job-search agent endpoints.

Exposes the agentic flow: interpret a natural-language instruction, run the
deterministic search/filter/analyze/rank pipeline, and let the user confirm
(save) or cancel the proposal. Every run is owned by a single user; all reads
and mutations are scoped by user_id to prevent IDOR.
"""
import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent_run import (
    AGENT_STATE_CANCELLED,
    AGENT_STATE_COMPLETED,
    AGENT_STATE_EXECUTING,
    AGENT_STATE_WAITING_FOR_USER,
    AGENT_TERMINAL_STATES,
    AgentRun,
)
from app.models.favorite import Favorite
from app.routers.user import get_current_user_record
from app.services.agent_service import _log_step, run_agent_search, serialize_run
from app.services.ai_quota_service import consume_ai_quota
from app.services.job_search_service import fetch_offers_for_search
from app.services.rate_limit_service import RateLimitRule, enforce_rate_limits
from app.services.security_service import get_client_ip

router = APIRouter(prefix="/api/agent", tags=["agent"])

MAX_INSTRUCTION_CHARS = 1500


class AgentSearchRequest(BaseModel):
    instruction: str = Field(min_length=3, max_length=MAX_INSTRUCTION_CHARS)
    override_filters: dict | None = None


class ConfirmRequest(BaseModel):
    offer_ids: list[str] = Field(default_factory=list)


def _profile_from_user(user) -> dict:
    """Map the stored user record to the profile dict the matching engine expects."""
    return {
        "experience": getattr(user, "anos_experiencia", "") or "",
        "stack": list(getattr(user, "stack", None) or []),
        "english": getattr(user, "ingles", "") or "",
        "ubicaciones": list(getattr(user, "ubicaciones", None) or []),
        "modalidad": list(getattr(user, "modalidad", None) or []),
        "idiomas": list(getattr(user, "idiomas", None) or []),
    }


@router.post("/search")
async def agent_search(body: AgentSearchRequest, request: Request, user=Depends(get_current_user_record), db: Session = Depends(get_db)):
    api_key = os.getenv("CLAUDE_API_KEY")
    try:
        if not getattr(user, "is_super_admin", False):
            enforce_rate_limits(
                db,
                [
                    RateLimitRule(
                        action="agent_ip",
                        bucket_key=f"ip:{get_client_ip(request)}",
                        limit=30,
                        window_seconds=3600,
                        detail="Demasiadas busquedas del agente desde esta IP. Intentalo mas tarde.",
                    ),
                    RateLimitRule(
                        action="agent_user",
                        bucket_key=f"user:{user.id}",
                        limit=15,
                        window_seconds=3600,
                        detail="Demasiadas busquedas del agente en poco tiempo. Espera un poco.",
                    ),
                ],
            )
            # Counts against the same daily AI quota as a normal match search.
            consume_ai_quota(db, user, "match")

        run = await run_agent_search(
            db=db,
            user=user,
            instruction=body.instruction,
            api_key=api_key,
            profile=_profile_from_user(user),
            fetch_offers=fetch_offers_for_search,
            override_filters=body.override_filters,
        )
        return JSONResponse(content={"run": serialize_run(run)}, media_type="application/json; charset=utf-8")
    except Exception as exc:  # noqa: BLE001
        message = str(exc)
        if "429" in message or "quota" in message.lower():
            return JSONResponse(status_code=429, content={"detail": "Cuota de IA agotada. Intentalo mas tarde."})
        return JSONResponse(status_code=502, content={"detail": f"El agente no pudo completar la busqueda: {message}"})
    finally:
        db.close()


@router.get("/runs")
def list_runs(user=Depends(get_current_user_record), db: Session = Depends(get_db)):
    try:
        runs = (
            db.query(AgentRun)
            .filter(AgentRun.user_id == user.id)
            .order_by(AgentRun.created_at.desc())
            .limit(30)
            .all()
        )
        return JSONResponse(
            content={
                "runs": [
                    {
                        "id": r.id,
                        "state": r.state,
                        "raw_instruction": r.raw_instruction,
                        "result_count": r.result_count,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                    }
                    for r in runs
                ]
            }
        )
    finally:
        db.close()


@router.get("/runs/{run_id}")
def get_run(run_id: int, user=Depends(get_current_user_record), db: Session = Depends(get_db)):
    try:
        run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.user_id == user.id).first()
        if not run:
            return JSONResponse(status_code=404, content={"detail": "Run no encontrado"})
        return JSONResponse(content={"run": serialize_run(run)}, media_type="application/json; charset=utf-8")
    finally:
        db.close()


@router.post("/runs/{run_id}/confirm")
def confirm_run(run_id: int, body: ConfirmRequest, user=Depends(get_current_user_record), db: Session = Depends(get_db)):
    """Human-approved action: persist the chosen offers as favorites."""
    try:
        run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.user_id == user.id).first()
        if not run:
            return JSONResponse(status_code=404, content={"detail": "Run no encontrado"})
        if run.state != AGENT_STATE_WAITING_FOR_USER:
            return JSONResponse(
                status_code=409,
                content={"detail": f"El run no admite confirmacion en estado {run.state}"},
            )

        try:
            results = json.loads(run.results_json) if run.results_json else []
        except (json.JSONDecodeError, TypeError):
            results = []

        wanted = set(body.offer_ids)
        chosen = [r for r in results if str(r.get("adzuna_id")) in wanted] if wanted else []

        _log_step(run, AGENT_STATE_EXECUTING, f"Guardando {len(chosen)} ofertas confirmadas por el usuario")
        saved = 0
        for offer in chosen:
            adzuna_id = str(offer.get("adzuna_id") or "")
            if not adzuna_id:
                continue
            exists = (
                db.query(Favorite)
                .filter(Favorite.user_id == user.id, Favorite.adzuna_id == adzuna_id)
                .first()
            )
            if exists:
                continue
            db.add(
                Favorite(
                    user_id=user.id,
                    adzuna_id=adzuna_id,
                    titulo=(offer.get("titulo") or "")[:500],
                    empresa=(offer.get("empresa") or "")[:300],
                    url=(offer.get("url") or "")[:2000],
                    resultado_ia=offer.get("resultado"),
                    created_at=datetime.utcnow(),
                )
            )
            saved += 1

        _log_step(run, AGENT_STATE_COMPLETED, f"Run completado: {saved} ofertas guardadas")
        db.commit()
        db.refresh(run)
        return JSONResponse(content={"saved": saved, "run": serialize_run(run)})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@router.post("/runs/{run_id}/cancel")
def cancel_run(run_id: int, user=Depends(get_current_user_record), db: Session = Depends(get_db)):
    try:
        run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.user_id == user.id).first()
        if not run:
            return JSONResponse(status_code=404, content={"detail": "Run no encontrado"})
        if run.state in AGENT_TERMINAL_STATES:
            return JSONResponse(status_code=409, content={"detail": f"El run ya esta en estado {run.state}"})
        _log_step(run, AGENT_STATE_CANCELLED, "Run cancelado por el usuario")
        db.commit()
        db.refresh(run)
        return JSONResponse(content={"run": serialize_run(run)})
    finally:
        db.close()
