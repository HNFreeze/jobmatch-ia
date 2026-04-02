# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base


class JobIngestionRun(Base):
    __tablename__ = "job_ingestion_runs"

    id = Column(Integer, primary_key=True, index=True)
    triggered_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String(40), nullable=False, index=True)
    trigger_mode = Column(String(40), nullable=False, default="manual", server_default="manual")
    requested_sources_json = Column(Text)
    requested_skills_json = Column(Text)
    requested_locations_json = Column(Text)
    log_lines_json = Column(Text)
    stats_json = Column(Text)
    fetched_count = Column(Integer, default=0, nullable=False, server_default="0")
    saved_new_count = Column(Integer, default=0, nullable=False, server_default="0")
    saved_updated_count = Column(Integer, default=0, nullable=False, server_default="0")
    inactive_count = Column(Integer, default=0, nullable=False, server_default="0")
    error_count = Column(Integer, default=0, nullable=False, server_default="0")
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
