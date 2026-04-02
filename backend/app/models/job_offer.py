# -*- coding: utf-8 -*-
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from app.database import Base


class JobOffer(Base):
    __tablename__ = "job_offers"

    id                = Column(Integer, primary_key=True, index=True)
    adzuna_id         = Column(String(100), unique=True, nullable=False, index=True)
    titulo            = Column(String(500))
    empresa           = Column(String(300))
    ubicacion         = Column(String(300))
    descripcion       = Column(Text)
    salario           = Column(String(200))
    fecha_publicacion = Column(String(50))
    url               = Column(String(2000))
    skills_detectadas = Column(Text)   # JSON: ["Python", "Django"]
    analysis_version  = Column(String(50))
    analysis_hash     = Column(String(64), index=True)
    offer_signals_json = Column(Text)
    signals_updated_at = Column(DateTime)
    source_name       = Column(String(100), index=True)
    source_type       = Column(String(50), index=True)
    source_job_id     = Column(String(200), index=True)
    source_confidence = Column(Float, default=0.58)
    source_metadata_json = Column(Text)
    raw_payload_json  = Column(Text)
    canonical_url     = Column(String(2000))
    canonical_company = Column(String(300), index=True)
    first_seen_at     = Column(DateTime, default=datetime.utcnow)
    last_seen_at      = Column(DateTime, default=datetime.utcnow, index=True)
    last_verified_at  = Column(DateTime)
    is_active         = Column(Boolean, default=True, nullable=False, index=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
