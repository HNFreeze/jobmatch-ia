# -*- coding: utf-8 -*-
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

_engine = None
_SessionLocal = None


def get_session_local():
    """Inicialización lazy: lee DATABASE_URL en tiempo de ejecución, no en importación."""
    global _engine, _SessionLocal
    if _SessionLocal is None:
        db_url = os.getenv("DATABASE_URL", "")
        if db_url:
            _engine = create_engine(db_url)
            _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _SessionLocal

def get_db():
    SessionLocal = get_session_local()
    if SessionLocal is None:
        raise RuntimeError("No database URL configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
