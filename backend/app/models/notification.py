# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    type = Column(String(50), default="info")   # info | success | warning | alert
    read = Column(Boolean, default=False, nullable=False, server_default="false")
    created_at = Column(DateTime, default=datetime.utcnow)
