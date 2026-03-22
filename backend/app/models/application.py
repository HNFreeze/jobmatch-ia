# -*- coding: utf-8 -*-
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from app.database import Base

class Application(Base):
    __tablename__ = "applications"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    adzuna_id   = Column(String(100), nullable=False)
    titulo      = Column(String(500))
    empresa     = Column(String(300))
    url         = Column(String(2000))
    status      = Column(String(50), default="guardada")  # guardada, aplicada, entrevista, oferta, descartada
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "adzuna_id", name="uq_application_user_adzuna"),
    )
