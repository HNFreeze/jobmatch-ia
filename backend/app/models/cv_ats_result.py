# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base


class CVAtsResult(Base):
    """Resultado de análisis ATS de un CV (puntuación + problemas detectados)."""
    __tablename__ = "cv_ats_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cv_text_hash = Column(String(64), nullable=False, index=True)  # SHA-256 del texto original
    original_cv_text = Column(Text, nullable=False)
    ats_score_before = Column(Integer, nullable=False)
    feedback_json = Column(Text, nullable=False)  # JSON: {problems, key_improvements, ...}
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
