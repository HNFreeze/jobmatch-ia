# -*- coding: utf-8 -*-
import argparse
import json

from app.database import get_session_local
from app.services.job_ingestion_service import (
    create_ingestion_run,
    get_ingestion_run_or_none,
    prepare_ingestion_payload,
    run_ingestion_task,
)


def _parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Lanza una ingesta manual de ofertas")
    parser.add_argument("--skills", help="Lista separada por comas de skills semilla")
    parser.add_argument("--locations", help="Lista separada por comas de ubicaciones")
    parser.add_argument("--sources", help="Fuentes separadas por comas: public_sources,adzuna")
    args = parser.parse_args()

    SessionLocal = get_session_local()
    if SessionLocal is None:
        print("Base de datos no disponible")
        return 1

    payload = prepare_ingestion_payload({
        "skills": _parse_csv(args.skills),
        "locations": _parse_csv(args.locations),
        "sources": _parse_csv(args.sources),
    })

    db = SessionLocal()
    try:
        run = create_ingestion_run(db, payload, user_id=None, trigger_mode="cli")
        run_id = run.id
    finally:
        db.close()

    print(f"[INGEST] run_id={run_id} iniciado con payload={json.dumps(payload, ensure_ascii=False)}")
    run_ingestion_task(run_id, payload)

    db = SessionLocal()
    try:
        run_data = get_ingestion_run_or_none(db, run_id)
    finally:
        db.close()

    if not run_data:
        print("[INGEST] no se pudo recuperar el resultado final")
        return 1

    print(f"[INGEST] estado={run_data['status']}")
    print(
        "[INGEST] resumen "
        f"fetched={run_data['fetched_count']} "
        f"new={run_data['saved_new_count']} "
        f"updated={run_data['saved_updated_count']} "
        f"inactive={run_data['inactive_count']} "
        f"errors={run_data['error_count']}"
    )
    for line in run_data.get("logs") or []:
        print(line)
    return 0 if run_data["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
