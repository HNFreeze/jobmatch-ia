# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    alias = Column(String(100), nullable=True)
    nombre = Column(String(100), nullable=True)
    apellidos = Column(String(200), nullable=True)
    anos_experiencia = Column(String(50))
    stack = Column(Text)    # JSON array almacenado como texto
    ingles = Column(String(50))
    idiomas = Column(Text)      # JSON: [{"idioma": "Inglés", "nivel": "avanzado"}, ...]
    ubicaciones = Column(Text)  # JSON: ["Madrid", "Barcelona"]
    modalidad = Column(Text)    # JSON: ["Presencial", "Híbrido", "Remoto"]
    onboarding_completed = Column(Boolean, default=False, nullable=False, server_default="false")
    email_verified = Column(Boolean, default=False, nullable=False, server_default="false")
    email_verified_at = Column(DateTime, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False, server_default="false")
    is_blocked = Column(Boolean, default=False, nullable=False, server_default="false")
    blocked_at = Column(DateTime, nullable=True)
    daily_ai_quota = Column(Integer, default=8, nullable=False, server_default="8")
    analytics_consent = Column(Boolean, nullable=True, default=None)
    is_super_admin = Column(Boolean, default=False, nullable=False, server_default="false")
    created_at = Column(DateTime, default=datetime.utcnow)
