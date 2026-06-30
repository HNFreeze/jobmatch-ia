from pathlib import Path
import asyncio
import logging
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

# Sentry — inicializar lo antes posible, solo si está configurado
_SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if _SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            environment=os.getenv("ENVIRONMENT", "development"),
            traces_sample_rate=0.1,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            send_default_pii=False,
        )
    except Exception:
        pass  # Sentry opcional — no bloquear arranque

# Cargar .env ANTES de importar cualquier módulo de app (database.py lee DATABASE_URL al importarse)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# FIX for Render and Heroku: SQLAlchemy 1.4+ requires postgresql:// instead of postgres://
if os.environ.get("DATABASE_URL", "").startswith("postgres://"):
    os.environ["DATABASE_URL"] = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from alembic.config import Config
from alembic import command

from app.routers import auth, user, match, favorites, application, history, cover_letter, company, admin, cv
from app.routers import notifications as notifications_router
from app.routers import interview as interview_router
from app.routers import agent as agent_router
from app.services.admin_bootstrap_service import ensure_bootstrap_admin
from app.services.job_ingestion_service import (
    create_ingestion_run,
    has_running_ingestion,
    prepare_ingestion_payload,
    run_ingestion_task,
)

# ── Logging ───────────────────────────────────────────────────────────────────
_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
_is_production = os.getenv("ENVIRONMENT", "development") == "production"

logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format=(
        '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}'
        if _is_production
        else "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    ),
)
logger = logging.getLogger("jobmatch.scheduler")

app = FastAPI(title="JobMatch-IA API")


def _cors_headers_for(request):
    """Cabeceras CORS para respuestas de error. El handler global vive por fuera
    del CORSMiddleware (ServerErrorMiddleware es el más externo), así que un 500
    saldría sin CORS y el navegador lo enmascara como error de CORS en vez de
    mostrar el error real. Reflejamos el Origin para que el front pueda leerlo."""
    origin = request.headers.get("origin")
    if not origin:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("Error no manejado: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
        headers=_cors_headers_for(request),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})

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


@app.middleware("http")
async def security_headers(request, call_next):
    """Cabeceras de seguridad en todas las respuestas: anti clickjacking,
    anti MIME-sniffing, control de referrer y permisos; HSTS solo en producción."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if _is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


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
app.include_router(notifications_router.router)
app.include_router(interview_router.router)
app.include_router(agent_router.router)


# ── Background scheduler ──────────────────────────────────────────────────────

INGESTION_INTERVAL_HOURS = int(os.getenv("JOB_INGESTION_INTERVAL_HOURS", "12"))

# Umbral de fallos consecutivos que dispara la notificación al super admin
_INGESTION_MAX_CONSECUTIVE_FAILURES = 3


def _notify_super_admin_ingestion_failure(db, consecutive_failures: int) -> None:
    """Inserta una notificación in-app al super admin cuando la ingesta falla varias veces seguidas."""
    try:
        from app.models.user import User
        from app.models.notification import Notification

        admin_user = db.query(User).filter(User.is_super_admin == True).first()
        if not admin_user:
            logger.warning("[SCHEDULER] No se encontró super admin para notificar el fallo de ingesta")
            return

        notification = Notification(
            user_id=admin_user.id,
            title="⚠️ Ingesta automática fallida",
            message=(
                f"La ingesta automática de ofertas ha fallado {consecutive_failures} veces consecutivas. "
                "Revisa los logs del servidor y el estado de la conexión a la API de empleos."
            ),
            type="error",
            read=False,
        )
        db.add(notification)
        db.commit()
        logger.error(
            "[SCHEDULER] Notificación de fallo enviada al super admin (user_id=%d, fallos_consecutivos=%d)",
            admin_user.id,
            consecutive_failures,
        )
    except Exception as notify_exc:
        logger.exception("[SCHEDULER] Error al crear notificación de fallo para el super admin: %s", notify_exc)
        try:
            db.rollback()
        except Exception:
            pass


async def _auto_ingestion_loop() -> None:
    """Ejecuta ingesta automática cada INGESTION_INTERVAL_HOURS horas."""
    interval = INGESTION_INTERVAL_HOURS * 3600
    # Espera inicial para no solapar con el startup
    await asyncio.sleep(300)
    consecutive_failures = 0
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
                        logger.info("[SCHEDULER] Ingesta automática iniciada — run_id=%s", run_id)
                        loop = asyncio.get_event_loop()
                        await loop.run_in_executor(None, run_ingestion_task, run_id, payload)
                        logger.info("[SCHEDULER] Ingesta automática completada — run_id=%s", run_id)
                        # Restablecer contador de fallos consecutivos tras un ciclo exitoso
                        consecutive_failures = 0
                    else:
                        logger.info("[SCHEDULER] Ingesta ya en curso, omitiendo ciclo")
                finally:
                    db.close()
        except Exception as exc:
            consecutive_failures += 1
            logger.error(
                "[SCHEDULER] Error en ingesta automática (fallo #%d): %s",
                consecutive_failures,
                exc,
                exc_info=True,
            )
            # Si se alcanza el umbral, notificar al super admin
            if consecutive_failures >= _INGESTION_MAX_CONSECUTIVE_FAILURES:
                try:
                    from app.database import get_session_local
                    SessionLocal = get_session_local()
                    if SessionLocal:
                        db_notify = SessionLocal()
                        try:
                            _notify_super_admin_ingestion_failure(db_notify, consecutive_failures)
                        finally:
                            db_notify.close()
                except Exception as db_exc:
                    logger.exception("[SCHEDULER] No se pudo abrir sesión para notificar al admin: %s", db_exc)
                # Reiniciar el contador para no enviar notificaciones en cada ciclo posterior
                consecutive_failures = 0
        await asyncio.sleep(interval)


@app.on_event("startup")
async def startup_tasks():
    # 0. Validación de variables de entorno críticas
    _is_prod = os.getenv("ENVIRONMENT", "development") == "production"
    _jwt_secret = os.getenv("JWT_SECRET", "dev-secret-inseguro")
    if _jwt_secret == "dev-secret-inseguro":
        if _is_prod:
            raise RuntimeError("JWT_SECRET no puede ser el valor por defecto en producción.")
        else:
            logger.warning("ADVERTENCIA: JWT_SECRET usa el valor por defecto inseguro — solo válido en desarrollo local.")

    if not os.getenv("CLAUDE_API_KEY"):
        logger.warning("ADVERTENCIA: CLAUDE_API_KEY no configurada — las funciones de IA no estarán disponibles.")
    if not os.getenv("DATABASE_URL"):
        logger.warning("ADVERTENCIA: DATABASE_URL no configurada — la base de datos no estará disponible.")
    if _is_prod and not os.getenv("APP_FRONTEND_URL"):
        logger.warning("ADVERTENCIA: APP_FRONTEND_URL no configurada en producción — el CORS puede no funcionar correctamente.")

    # 1. Migraciones Alembic
    alembic_cfg = Config(Path(__file__).resolve().parent.parent / "alembic.ini")
    alembic_cfg.set_main_option("script_location", str(Path(__file__).resolve().parent.parent / "alembic"))
    command.upgrade(alembic_cfg, "head")

    # 2. Bootstrap admin
    ensure_bootstrap_admin()

    # 3. Lanzar loops en background (solo si la BD está disponible)
    if os.getenv("DATABASE_URL"):
        asyncio.create_task(_auto_ingestion_loop())
        logger.info(
            "[SCHEDULER] Ingesta automática cada %dh",
            INGESTION_INTERVAL_HOURS,
        )


@app.get("/")
def root():
    return {"message": "JobMatch-IA API running"}


@app.get("/health")
def health_check():
    """Health check con estado de la base de datos e índice de ofertas."""
    from datetime import datetime
    from app.database import get_session_local
    from app.models.job_offer import JobOffer

    status = {"status": "ok", "timestamp": datetime.utcnow().isoformat(), "version": "1.0.0"}

    SessionLocal = get_session_local()
    if SessionLocal is None:
        status["database"] = "unavailable"
        status["status"] = "degraded"
        return status

    try:
        db = SessionLocal()
        active_offers = db.query(JobOffer).filter(JobOffer.is_active.is_(True)).count()
        status["database"] = "ok"
        status["active_offers"] = active_offers
        status["ai_available"] = bool(os.getenv("CLAUDE_API_KEY"))
        db.close()
    except Exception as exc:
        status["database"] = f"error: {exc}"
        status["status"] = "degraded"

    return status
