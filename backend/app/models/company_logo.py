# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.database import Base


class CompanyLogo(Base):
    """Unified company data cache: logo + metadata.

    Table keeps the name ``company_logos`` for backward-compat with existing
    migrations; the class is aliased as ``CompanyData`` at module level.
    Rating columns are kept only for backward-compat with existing deployments
    and as a possible future slot for real external review data.
    """

    __tablename__ = "company_logos"

    id = Column(Integer, primary_key=True, index=True)
    company_name_original = Column(String(300), nullable=False)
    company_name_normalized = Column(String(300), nullable=False, unique=True, index=True)
    resolved_domain = Column(String(255))

    # ── Logo fields ──────────────────────────────────────────────────────
    logo_url = Column(String(2000))
    status = Column(String(20), nullable=False, default="not_found")
    source = Column(String(100))

    # ── Rating fields ────────────────────────────────────────────────────
    rating_value = Column(Float, nullable=True)
    rating_count = Column(Integer, nullable=True)
    rating_source = Column(String(100), nullable=True)
    rating_status = Column(String(20), nullable=False, server_default="pending")

    # External review source links
    glassdoor_url = Column(String(2000), nullable=True)
    kununu_url = Column(String(2000), nullable=True)
    trustpilot_url = Column(String(2000), nullable=True)
    review_status = Column(String(20), nullable=False, server_default="unavailable")
    review_checked_at = Column(DateTime, nullable=True)

    # ── Timestamps ───────────────────────────────────────────────────────
    last_attempt_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Alias for semantic clarity in new code
CompanyData = CompanyLogo
