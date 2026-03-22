# -*- coding: utf-8 -*-
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.database import Base


class SearchCache(Base):
    __tablename__ = "search_cache"

    id = Column(Integer, primary_key=True, index=True)
    perfil_hash = Column(String(64), unique=True, nullable=False, index=True)
    ofertas_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(hours=24))
