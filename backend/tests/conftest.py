# -*- coding: utf-8 -*-
"""Shared pytest fixtures for unit tests.

Battery tests (marked with pytest.mark.battery) connect to a real backend
on localhost:8000 and do NOT use these fixtures.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from types import SimpleNamespace


@pytest.fixture(scope="session")
def sqlite_engine():
    """In-memory SQLite engine with all app tables created once per session."""
    from app.database import Base

    # Import all models so Base.metadata is fully populated
    from app.models import (  # noqa: F401
        CVAnalysis, CVAtsResult, CVEditSession, CVImprovement, CVOfferVariant,
        Favorite, JobOffer, RateLimitBucket, SearchHistory, User,
    )
    from app.models.application import Application  # noqa: F401
    from app.models.interview_session import InterviewSession  # noqa: F401
    from app.models.match_feedback import MatchFeedback  # noqa: F401
    from app.models.notification import Notification  # noqa: F401
    from app.models.ai_daily_usage import AIDailyUsage  # noqa: F401
    from app.models.ai_api_cost_event import AIAPICostEvent  # noqa: F401
    from app.models.cache import SearchCache  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture()
def db_session(sqlite_engine):
    """Transactional DB session that rolls back after each test."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sqlite_engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def test_user():
    """Minimal user namespace for mocking get_current_user_record."""
    return SimpleNamespace(
        id=1,
        email="test@example.com",
        alias="testuser",
        nombre="Test",
        apellidos="User",
        is_admin=False,
        is_super_admin=False,
        is_blocked=False,
        daily_ai_quota=8,
        stack=[],
        idiomas=[],
        ubicaciones=[],
        modalidad=[],
        stack_years={},
        anos_experiencia="3",
        onboarding_completed=True,
        analytics_consent=None,
    )
