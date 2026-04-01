# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text

from app.database import Base


class CVImprovement(Base):
    """CV mejorado por IA (texto completo + puntuación ATS tras mejora)."""
    __tablename__ = "cv_improvements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ats_result_id = Column(Integer, ForeignKey("cv_ats_results.id"), nullable=True, index=True)
    improved_cv_text = Column(Text, nullable=False)      # Texto legacy (derivado del JSON)
    cv_structured_json = Column(Text, nullable=True)      # JSON canónico del CV mejorado
    ats_score_before = Column(Integer, nullable=False)
    ats_score_after = Column(Integer, nullable=False)
    meta_json = Column(Text, nullable=True)  # JSON: keywords_added, improvements list, etc.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
