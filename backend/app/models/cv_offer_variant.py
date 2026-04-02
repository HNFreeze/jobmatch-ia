# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base


class CVOfferVariant(Base):
    """Variante editable del CV enfocada a una oferta concreta."""

    __tablename__ = "cv_offer_variants"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    improvement_id = Column(Integer, ForeignKey("cv_improvements.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    offer_adzuna_id = Column(String(100), nullable=True, index=True)
    offer_title = Column(String(500), nullable=True)
    offer_company = Column(String(300), nullable=True)
    offer_url = Column(String(2000), nullable=True)
    offer_snapshot_json = Column(Text, nullable=True)
    edited_cv_json = Column(Text, nullable=False)
    action_log_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
