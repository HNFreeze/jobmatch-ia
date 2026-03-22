# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from app.database import Base


class RateLimitBucket(Base):
    __tablename__ = "rate_limit_buckets"
    __table_args__ = (
        UniqueConstraint("action", "bucket_key", "window_start", name="uq_rate_limit_bucket"),
    )

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    bucket_key = Column(String(255), nullable=False, index=True)
    window_start = Column(DateTime, nullable=False, index=True)
    count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False, onupdate=datetime.utcnow)
