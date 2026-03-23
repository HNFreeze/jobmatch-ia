import os
import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config, create_engine
from sqlalchemy import pool

from alembic import context

# Añadir backend/ al sys.path para poder importar app.*
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Cargar variables de entorno desde backend/.env
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Importar Base y modelos para que alembic los detecte
from app.database import Base
from app.models.ai_daily_usage import AIDailyUsage  # noqa: F401
from app.models.ai_api_cost_event import AIAPICostEvent  # noqa: F401
from app.models.cache import SearchCache  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.application import Application  # noqa: F401
from app.models.company_logo import CompanyLogo  # noqa: F401
from app.models.email_verification_token import EmailVerificationToken  # noqa: F401
from app.models.job_offer import JobOffer        # noqa: F401
from app.models.favorite import Favorite          # noqa: F401
from app.models.rate_limit_bucket import RateLimitBucket  # noqa: F401
from app.models.search_history import SearchHistory  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

DATABASE_URL = os.getenv("DATABASE_URL", "")


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(DATABASE_URL, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
