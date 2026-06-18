import asyncio
import json
import os
from datetime import datetime

from app.database import get_session_local
from app.models.job_ingestion_run import JobIngestionRun
from app.models.job_offer import JobOffer
from app.services.adzuna_service import fetch_offers_from_adzuna
from app.services.job_index_service import save_offers_to_db
from app.services.job_verification_service import refresh_stale_job_offers
from app.services.jobspy_service import fetch_offers_from_jobspy
from app.services.jsearch_service import fetch_offers_from_jsearch
from app.services.official_sources_service import fetch_offers_from_public_sources_with_details


DEFAULT_INGESTION_SKILLS = [
    "python",
    "react",
    "javascript",
    "typescript",
    "java",
    "backend",
    "frontend",
    "devops",
    "data engineer",
    # SQL / BI / data roles — frecuentes en España
    "SQL Server",
    "PL/SQL",
    "SSIS",
    "SSRS",
    "Power BI",
    "ETL",
    "Business Intelligence",
    "data warehouse",
    "T-SQL",
]
DEFAULT_INGESTION_LOCATIONS = ["Madrid", "Barcelona", "Valencia", "Toda España"]


def _parse_csv_env(name: str, fallback: list[str]) -> list[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return fallback[:]
    return [item.strip() for item in raw.split(",") if item.strip()]


def get_default_ingestion_skills() -> list[str]:
    return _parse_csv_env("JOB_INGESTION_SKILLS", DEFAULT_INGESTION_SKILLS)


def get_default_ingestion_locations() -> list[str]:
    return _parse_csv_env("JOB_INGESTION_LOCATIONS", DEFAULT_INGESTION_LOCATIONS)


def get_default_ingestion_sources() -> list[str]:
    return _parse_csv_env("JOB_INGESTION_SOURCES", ["public_sources", "adzuna"])


def normalize_requested_sources(sources: list[str] | None) -> list[str]:
    cleaned = [str(item or "").strip().lower() for item in (sources or []) if str(item or "").strip()]
    if not cleaned:
        return get_default_ingestion_sources()
    allowed = {"public_sources", "adzuna", "jobspy", "jsearch"}
    return [item for item in cleaned if item in allowed] or get_default_ingestion_sources()


def prepare_ingestion_payload(payload: dict | None = None) -> dict:
    payload = payload or {}
    skills = payload.get("skills")
    locations = payload.get("locations")
    sources = payload.get("sources")

    normalized_skills = [str(item).strip() for item in (skills or get_default_ingestion_skills()) if str(item).strip()]
    normalized_locations = [str(item).strip() for item in (locations or get_default_ingestion_locations()) if str(item).strip()]
    normalized_sources = normalize_requested_sources(sources)

    return {
        "skills": normalized_skills,
        "locations": normalized_locations,
        "sources": normalized_sources,
    }


def _serialize_run(run: JobIngestionRun) -> dict:
    try:
        requested_sources = json.loads(run.requested_sources_json or "[]")
    except Exception:
        requested_sources = []
    try:
        requested_skills = json.loads(run.requested_skills_json or "[]")
    except Exception:
        requested_skills = []
    try:
        requested_locations = json.loads(run.requested_locations_json or "[]")
    except Exception:
        requested_locations = []
    try:
        log_lines = json.loads(run.log_lines_json or "[]")
    except Exception:
        log_lines = []
    try:
        stats = json.loads(run.stats_json or "{}")
    except Exception:
        stats = {}

    return {
        "id": run.id,
        "status": run.status,
        "trigger_mode": run.trigger_mode,
        "requested_sources": requested_sources,
        "requested_skills": requested_skills,
        "requested_locations": requested_locations,
        "fetched_count": int(run.fetched_count or 0),
        "saved_new_count": int(run.saved_new_count or 0),
        "saved_updated_count": int(run.saved_updated_count or 0),
        "inactive_count": int(run.inactive_count or 0),
        "error_count": int(run.error_count or 0),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
        "logs": log_lines,
        "stats": stats,
    }


def list_ingestion_runs(db, *, limit: int = 12) -> list[dict]:
    rows = (
        db.query(JobIngestionRun)
        .order_by(JobIngestionRun.created_at.desc(), JobIngestionRun.id.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_run(row) for row in rows]


def get_ingestion_run_or_none(db, run_id: int) -> dict | None:
    row = db.query(JobIngestionRun).filter(JobIngestionRun.id == run_id).first()
    return _serialize_run(row) if row else None


def has_running_ingestion(db) -> bool:
    return (
        db.query(JobIngestionRun)
        .filter(JobIngestionRun.status == "running")
        .first()
        is not None
    )


def create_ingestion_run(db, payload: dict, *, user_id: int | None = None, trigger_mode: str = "manual") -> JobIngestionRun:
    now = datetime.utcnow()
    run = JobIngestionRun(
        triggered_by_user_id=user_id,
        status="queued",
        trigger_mode=trigger_mode,
        requested_sources_json=json.dumps(payload.get("sources") or [], ensure_ascii=False),
        requested_skills_json=json.dumps(payload.get("skills") or [], ensure_ascii=False),
        requested_locations_json=json.dumps(payload.get("locations") or [], ensure_ascii=False),
        log_lines_json=json.dumps([], ensure_ascii=False),
        stats_json=json.dumps({}, ensure_ascii=False),
        created_at=now,
        updated_at=now,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _append_run_log(run: JobIngestionRun, message: str) -> None:
    try:
        lines = json.loads(run.log_lines_json or "[]")
    except Exception:
        lines = []
    timestamp = datetime.utcnow().strftime("%H:%M:%S")
    lines.append(f"[{timestamp}] {message}")
    run.log_lines_json = json.dumps(lines[-120:], ensure_ascii=False)
    run.updated_at = datetime.utcnow()


def _set_run_stats(run: JobIngestionRun, stats: dict) -> None:
    run.stats_json = json.dumps(stats, ensure_ascii=False)
    run.updated_at = datetime.utcnow()


def _count_existing_offers(db, offers: list[dict]) -> tuple[int, int]:
    offer_ids = [offer.get("adzuna_id") for offer in offers if offer.get("adzuna_id")]
    if not offer_ids:
        return 0, 0
    existing_count = (
        db.query(JobOffer)
        .filter(JobOffer.adzuna_id.in_(offer_ids))
        .count()
    )
    new_count = max(0, len(set(offer_ids)) - existing_count)
    return new_count, existing_count


async def _run_ingestion_internal(run_id: int, payload: dict) -> None:
    SessionLocal = get_session_local()
    if SessionLocal is None:
        return

    db = SessionLocal()
    try:
        run = db.query(JobIngestionRun).filter(JobIngestionRun.id == run_id).first()
        if not run:
            return

        run.status = "running"
        run.started_at = datetime.utcnow()
        run.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(run)

        skills = payload.get("skills") or []
        locations = payload.get("locations") or []
        sources = payload.get("sources") or []
        adzuna_seed_limit = int(os.getenv("JOB_INGESTION_MAX_ADZUNA_SEEDS", "4") or "4")

        stats = {
            "sources": [],
            "skills": skills,
            "locations": locations,
            "verification": {},
        }
        fetched_count = 0
        saved_new_count = 0
        saved_updated_count = 0
        error_count = 0

        _append_run_log(run, f"Iniciando ingesta manual con fuentes: {', '.join(sources)}")
        _append_run_log(run, f"Skills semilla: {', '.join(skills) if skills else 'ninguna'}")
        _append_run_log(run, f"Ubicaciones: {', '.join(locations) if locations else 'sin filtro'}")
        db.commit()

        if "public_sources" in sources:
            _append_run_log(run, "Consultando fuentes públicas/oficiales...")
            db.commit()
            public_result = await fetch_offers_from_public_sources_with_details(skills, locations=locations)
            public_offers = public_result.get("offers") or []
            fetched_count += len(public_offers)
            new_count, updated_count = _count_existing_offers(db, public_offers)
            if public_offers:
                save_offers_to_db(db, public_offers, skills)
            saved_new_count += new_count
            saved_updated_count += updated_count
            for source_item in public_result.get("sources") or []:
                stats["sources"].append(source_item)
                if source_item.get("status") == "error":
                    error_count += 1
                    _append_run_log(run, f"{source_item.get('source')}: error - {source_item.get('error')}")
                else:
                    _append_run_log(run, f"{source_item.get('source')}: {source_item.get('fetched_count', 0)} ofertas")
            if public_offers:
                _append_run_log(run, f"Fuentes públicas guardadas: {len(public_offers)} ofertas ({new_count} nuevas, {updated_count} actualizadas)")
            else:
                _append_run_log(run, "Fuentes públicas sin nuevas ofertas para guardar")
            db.commit()

        if "adzuna" in sources:
            _append_run_log(run, "Consultando Adzuna como fuente manual de apoyo...")
            db.commit()
            adzuna_seeds = skills[:adzuna_seed_limit] if skills else ["developer"]
            adzuna_stats = []
            for seed in adzuna_seeds:
                seed_offers = await fetch_offers_from_adzuna([seed], locations=locations, db=None, fallback_query=None)
                seed_offers = seed_offers or []
                fetched_count += len(seed_offers)
                new_count, updated_count = _count_existing_offers(db, seed_offers)
                if seed_offers:
                    save_offers_to_db(db, seed_offers, [seed])
                saved_new_count += new_count
                saved_updated_count += updated_count
                adzuna_stats.append({
                    "source": f"adzuna:{seed}",
                    "status": "ok",
                    "fetched_count": len(seed_offers),
                })
                _append_run_log(run, f"Adzuna '{seed}': {len(seed_offers)} ofertas ({new_count} nuevas, {updated_count} actualizadas)")
                db.commit()
            stats["sources"].extend(adzuna_stats)

        if "jobspy" in sources:
            _append_run_log(run, "Consultando Indeed via JobSpy...")
            db.commit()
            try:
                jobspy_offers = await fetch_offers_from_jobspy(skills, locations=locations)
                jobspy_offers = jobspy_offers or []
                fetched_count += len(jobspy_offers)
                new_count, updated_count = _count_existing_offers(db, jobspy_offers)
                if jobspy_offers:
                    save_offers_to_db(db, jobspy_offers, skills)
                saved_new_count += new_count
                saved_updated_count += updated_count
                stats["sources"].append({"source": "jobspy_indeed", "status": "ok", "fetched_count": len(jobspy_offers)})
                _append_run_log(run, f"JobSpy/Indeed: {len(jobspy_offers)} ofertas ({new_count} nuevas, {updated_count} actualizadas)")
            except Exception as exc:
                error_count += 1
                stats["sources"].append({"source": "jobspy_indeed", "status": "error", "error": str(exc)[:200]})
                _append_run_log(run, f"JobSpy error: {str(exc)[:200]}")
            db.commit()

        if "jsearch" in sources:
            _append_run_log(run, "Consultando JSearch API (LinkedIn/Indeed/Glassdoor)...")
            db.commit()
            try:
                jsearch_offers = await fetch_offers_from_jsearch(skills, locations=locations)
                jsearch_offers = jsearch_offers or []
                fetched_count += len(jsearch_offers)
                new_count, updated_count = _count_existing_offers(db, jsearch_offers)
                if jsearch_offers:
                    save_offers_to_db(db, jsearch_offers, skills)
                saved_new_count += new_count
                saved_updated_count += updated_count
                stats["sources"].append({"source": "jsearch", "status": "ok", "fetched_count": len(jsearch_offers)})
                _append_run_log(run, f"JSearch: {len(jsearch_offers)} ofertas ({new_count} nuevas, {updated_count} actualizadas)")
            except Exception as exc:
                error_count += 1
                stats["sources"].append({"source": "jsearch", "status": "error", "error": str(exc)[:200]})
                _append_run_log(run, f"JSearch error: {str(exc)[:200]}")
            db.commit()

        _append_run_log(run, "Reverificando ofertas antiguas para refrescar estado...")
        db.commit()
        verification_result = await refresh_stale_job_offers(db)
        stats["verification"] = verification_result
        _append_run_log(
            run,
            f"Verificación completada: {verification_result.get('checked', 0)} revisadas, "
            f"{verification_result.get('inactive', 0)} inactivas, {verification_result.get('refreshed', 0)} refrescadas",
        )

        run.fetched_count = fetched_count
        run.saved_new_count = saved_new_count
        run.saved_updated_count = saved_updated_count
        run.inactive_count = int(verification_result.get("inactive", 0) or 0)
        run.error_count = error_count
        run.status = "completed"
        run.finished_at = datetime.utcnow()
        _set_run_stats(
            run,
            {
                **stats,
                "summary": {
                    "fetched_count": fetched_count,
                    "saved_new_count": saved_new_count,
                    "saved_updated_count": saved_updated_count,
                    "inactive_count": run.inactive_count,
                    "error_count": error_count,
                },
            },
        )
        _append_run_log(run, "Ingesta finalizada correctamente")
        db.commit()
    except Exception as exc:
        db.rollback()
        run = db.query(JobIngestionRun).filter(JobIngestionRun.id == run_id).first()
        if run:
            run.status = "failed"
            run.finished_at = datetime.utcnow()
            run.error_count = int(run.error_count or 0) + 1
            _append_run_log(run, f"Error en la ingesta: {str(exc)[:400]}")
            run.updated_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


def run_ingestion_task(run_id: int, payload: dict) -> None:
    asyncio.run(_run_ingestion_internal(run_id, payload))
