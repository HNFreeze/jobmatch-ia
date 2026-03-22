# -*- coding: utf-8 -*-
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class CompanyLogo(Base):
    __tablename__ = "company_logos"

    id = Column(Integer, primary_key=True, index=True)
    company_name_original = Column(String(300), nullable=False)
    company_name_normalized = Column(String(300), nullable=False, unique=True, index=True)
    resolved_domain = Column(String(255))
    logo_url = Column(String(2000))
    status = Column(String(20), nullable=False, default="not_found")
    source = Column(String(100))
    last_attempt_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
