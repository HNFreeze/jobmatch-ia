# -*- coding: utf-8 -*-
"""Persisted execution of the personal job-search agent.

Each AgentRun captures one run of the agentic flow: the natural-language
instruction, its structured interpretation, the deterministic plan, the
state-machine trace and the ranked, explainable results. The run is the
unit of traceability and human-in-the-loop confirmation.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database import Base

# ── State machine ──────────────────────────────────────────────────────────
# A run advances deterministically through these states. Only WAITING_FOR_USER
# accepts a human action (confirm / cancel) before EXECUTING_APPROVED_ACTION.
AGENT_STATE_CREATED = "CREATED"
AGENT_STATE_INTERPRETING = "INTERPRETING"
AGENT_STATE_SEARCHING = "SEARCHING"
AGENT_STATE_FILTERING = "FILTERING"
AGENT_STATE_ANALYZING = "ANALYZING"
AGENT_STATE_RANKING = "RANKING"
AGENT_STATE_WAITING_FOR_USER = "WAITING_FOR_USER"
AGENT_STATE_EXECUTING = "EXECUTING_APPROVED_ACTION"
AGENT_STATE_COMPLETED = "COMPLETED"
AGENT_STATE_FAILED = "FAILED"
AGENT_STATE_CANCELLED = "CANCELLED"

AGENT_STATES = (
    AGENT_STATE_CREATED,
    AGENT_STATE_INTERPRETING,
    AGENT_STATE_SEARCHING,
    AGENT_STATE_FILTERING,
    AGENT_STATE_ANALYZING,
    AGENT_STATE_RANKING,
    AGENT_STATE_WAITING_FOR_USER,
    AGENT_STATE_EXECUTING,
    AGENT_STATE_COMPLETED,
    AGENT_STATE_FAILED,
    AGENT_STATE_CANCELLED,
)

# Terminal states cannot transition further.
AGENT_TERMINAL_STATES = frozenset(
    {AGENT_STATE_COMPLETED, AGENT_STATE_FAILED, AGENT_STATE_CANCELLED}
)


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    raw_instruction = Column(Text, nullable=False)
    # Structured SearchInstruction (validated by Pydantic) serialized as JSON text.
    interpreted_filters_json = Column(Text, nullable=True)
    # Source of the interpretation: "ai" or "fallback" (deterministic).
    interpretation_source = Column(String(20), nullable=True)
    # Ordered list of plan steps the agent intends to run, JSON text.
    plan_json = Column(Text, nullable=True)
    # Trace of state transitions: [{"state", "detail", "ts"}], JSON text.
    step_log_json = Column(Text, nullable=True)
    # Compact ranked results with explanations, JSON text.
    results_json = Column(Text, nullable=True)
    # Human-readable summary of why the agent ranked things the way it did.
    explanation = Column(Text, nullable=True)

    state = Column(String(40), nullable=False, default=AGENT_STATE_CREATED, index=True)
    error = Column(Text, nullable=True)

    # Cost / observability counters.
    offers_found = Column(Integer, nullable=False, default=0)
    offers_discarded_prefilter = Column(Integer, nullable=False, default=0)
    offers_analyzed = Column(Integer, nullable=False, default=0)
    result_count = Column(Integer, nullable=False, default=0)
    ai_calls = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
