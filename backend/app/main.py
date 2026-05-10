from pathlib import Path
import asyncio
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

# Cargar .env ANTES de importar cualquier módulo de app (database.py lee DATABASE_URL al importarse)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alembic.config import Config
from alembic import command

from app.routers import auth, user, match, favorites, application, history, cover_letter, company, admin, cv
from app.routers import alerts as alerts_router
from app.services.admin_bootstrap_service import ensure_bootstrap_admin
from app.services.job_ingestion_service import (
    create_ingestion_run,
    has_running_ingestion,
    prepare_ingestion_payload,
    run_ingestion_task,
)
from app.services.alert_service import process_job_alerts

app = FastAPI(title="JobMatch-IA API")

frontend_url = os.getenv("APP_FRONTEND_URL", "").strip()
allowed_origins = []
if frontend_url:
    allowed_origins.append(frontend_url.rstrip("/"))
    parsed = urlparse(frontend_url)
    if parsed.scheme and parsed.hostname:
        allowed_origins.append(f"{parsed.scheme}://{parsed.hostname}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?|https://([a-zA-Z0-9-]+\.)*vercel\.app)$",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(match.router)
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(favorites.router)
app.include_router(application.router)
app.include_router(history.router)
app.include_router(cover_letter.router)
app.include_router(company.router)
app.include_router(admin.router)
app.include_router(cv.router)
app.include_router(alerts_router.router)


# ── Background scheduler ──────────────────────────────────────────────────────

INGESTION_INTERVAL_HOURS = int(os.getenv("JOB_INGESTION_INTERVAL_HOURS", "12"))
ALERTS_INTERVAL_HOURS = int(os.getenv("ALERTS_INTERVAL_HOURS", "24"))


async def _auto_ingestion_loop() -> None:
    """Ejecuta ingesta automática cada INGESTION_INTERVAL_HOURS horas."""
    interval = INGESTION_INTERVAL_HOURS * 3600
    # Espera inicial para no solapar con el startup
    await asyncio.sleep(300)
    while True:
        try:
            from app.database import get_session_local
            SessionLocal = get_session_local()
            if SessionLocal:
                db = SessionLocal()
                try:
                    if not has_running_ingestion(db):
                        payload = prepare_ingestion_payload()
                        run = create_ingestion_run(db, payload, trigger_mode="scheduled")
                        run_id = run.id
                        print(f"[SCHEDULER] Ingesta automática iniciada — run_id={run_id}")
                        loop = asyncio.get_event_loop()
                        await loop.run_in_executor(None, run_ingestion_task, run_id, payload)
                        print(f"[SCHEDULER] Ingesta automática completada — run_id={run_id}")
                    else:
                        print("[SCHEDULER] Ingesta ya en curso, omitiendo ciclo")
                finally:
                    db.close()
        except Exception as exc:
            print(f"[SCHEDULER] Error en ingesta automática: {exc}")
        await asyncio.sleep(interval)


async def _auto_alerts_loop() -> None:
    """Procesa alertas de empleo cada ALERTS_INTERVAL_HOURS horas."""
    interval = ALERTS_INTERVAL_HOURS * 3600
    # Espera inicial: 600s tras arrancar
    await asyncio.sleep(600)
    while True:
        try:
            print("[SCHEDULER] Procesando alertas de empleo...")
            summary = process_job_alerts()
            print(f"[SCHEDULER] Alertas completadas: {summary}")
        except Exception as exc:
            print(f"[SCHEDULER] Error en alertas: {exc}")
        await asyncio.sleep(interval)


@app.on_event("startup")
async def startup_tasks():
    # 1. Migraciones Alembic
    alembic_cfg = Config(Path(__file__).resolve().parent.parent / "alembic.ini")
    alembic_cfg.set_main_option("script_location", str(Path(__file__).resolve().parent.parent / "alembic"))
    command.upgrade(alembic_cfg, "head")

    # 2. Bootstrap admin
    ensure_bootstrap_admin()

    # 3. Lanzar loops en background (solo si la BD está disponible)
    if os.getenv("DATABASE_URL"):
        asyncio.create_task(_auto_ingestion_loop())
        asyncio.create_task(_auto_alerts_loop())
        print(f"[SCHEDULER] Ingesta automática cada {INGESTION_INTERVAL_HOURS}h, alertas cada {ALERTS_INTERVAL_HOURS}h")


@app.get("/")
def root():
    return {"message": "JobMatch-IA API running"}
