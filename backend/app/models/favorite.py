# -*- coding: utf-8 -*-
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from app.database import Base


class Favorite(Base):
    __tablename__ = "favoritos"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    adzuna_id   = Column(String(100), nullable=False)
    titulo      = Column(String(500))
    empresa     = Column(String(300))
    url         = Column(String(2000))
    resultado_ia = Column(String(20))
    created_at  = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "adzuna_id", name="uq_favoritos_user_adzuna"),
    )
