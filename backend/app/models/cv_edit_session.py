# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text

from app.database import Base


class CVEditSession(Base):
    """Sesión de edición manual del CV mejorado por el usuario.

    Guarda el JSON canónico editado y el log de acciones para:
    - Generar el PDF desde el estado corregido
    - Reutilizar preferencias de estructura en futuras generaciones
    """
    __tablename__ = "cv_edit_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    improvement_id = Column(Integer, ForeignKey("cv_improvements.id"), nullable=False, index=True)
    edited_cv_json = Column(Text, nullable=False)           # JSON canónico tras edición del usuario
    action_log_json = Column(Text, nullable=False, default="[]")  # Array de acciones realizadas
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
