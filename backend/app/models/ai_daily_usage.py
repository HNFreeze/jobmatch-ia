# -*- coding: utf-8 -*-
from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, UniqueConstraint

from app.database import Base


class AIDailyUsage(Base):
    __tablename__ = "ai_daily_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_ai_daily_usage_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    usage_date = Column(Date, nullable=False, default=date.today, index=True)
    match_count = Column(Integer, nullable=False, default=0)
    cover_letter_count = Column(Integer, nullable=False, default=0)
    cv_analysis_count = Column(Integer, nullable=False, default=0)
    cv_improve_count = Column(Integer, nullable=False, default=0)
    total_units = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False, onupdate=datetime.utcnow)
