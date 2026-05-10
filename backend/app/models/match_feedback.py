# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class MatchFeedback(Base):
    __tablename__ = "match_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    adzuna_id = Column(String(255), nullable=False, index=True)

    # "up" = buena predicción, "down" = mala predicción
    rating = Column(String(10), nullable=False)  # "up" | "down"

    # Score que tenía la oferta cuando se dio el feedback
    offer_score = Column(Integer, nullable=True)
    offer_result = Column(String(20), nullable=True)  # APLICA | QUIZÁ | NO_ENCAJA

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", backref="match_feedbacks")
