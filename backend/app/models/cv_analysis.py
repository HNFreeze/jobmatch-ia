# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base


class CVAnalysis(Base):
    __tablename__ = "cv_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Metadata del fichero
    filename_original = Column(String(255), nullable=True)
    file_size_bytes = Column(Integer, nullable=False)
    content_type = Column(String(100), nullable=False)

    # Perfil estructurado extraído por la IA (JSON)
    structured_profile_json = Column(Text, nullable=False)

    # Solo un análisis puede ser el activo por usuario
    is_latest = Column(Boolean, nullable=False, default=True, server_default="true")

    # Tracking de uso IA
    ai_model = Column(String(120), nullable=True)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
