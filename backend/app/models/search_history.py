# -*- coding: utf-8 -*-
from datetime import datetime
from sqlalchemy import JSON, Column, Integer, String, Text, DateTime, ForeignKey
from app.database import Base


class SearchHistory(Base):
    __tablename__ = "historial_busquedas"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stack            = Column(JSON)
    anos_experiencia = Column(String(50))
    ubicaciones      = Column(JSON)
    modalidad        = Column(JSON)
    num_aplica       = Column(Integer, default=0)
    num_quiza        = Column(Integer, default=0)
    num_no_encaja         = Column(Integer, default=0)
    satisfaction_rating   = Column(Integer, nullable=True)   # 1-5
    satisfaction_comment  = Column(Text, nullable=True)
    created_at            = Column(DateTime, default=datetime.utcnow)
