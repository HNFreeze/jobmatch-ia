# -*- coding: utf-8 -*-
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
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
    created_at        = Column(DateTime, default=datetime.utcnow)
