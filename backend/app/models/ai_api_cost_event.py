# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.database import Base


class AIAPICostEvent(Base):
    __tablename__ = "ai_api_cost_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    feature = Column(String(80), nullable=False, index=True)
    model = Column(String(120), nullable=False, index=True)
    request_id = Column(String(120), nullable=True)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    cache_creation_input_tokens = Column(Integer, nullable=False, default=0)
    cache_read_input_tokens = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
