# -*- coding: utf-8 -*-
from datetime import datetime
from sqlalchemy import JSON, Column, Integer, String, Text, DateTime, ForeignKey
from app.database import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    job_title = Column(String(500), nullable=False)
    company = Column(String(500), nullable=False, default="")
    job_description = Column(Text, nullable=True)
    conversation_json = Column(JSON, nullable=False, default=list)
    status = Column(String(50), nullable=False, default="active")   # active | completed
    feedback_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
