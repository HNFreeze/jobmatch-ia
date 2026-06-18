# -*- coding: utf-8 -*-
"""add agent_runs table

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("raw_instruction", sa.Text(), nullable=False),
        sa.Column("interpreted_filters_json", sa.Text(), nullable=True),
        sa.Column("interpretation_source", sa.String(length=20), nullable=True),
        sa.Column("plan_json", sa.Text(), nullable=True),
        sa.Column("step_log_json", sa.Text(), nullable=True),
        sa.Column("results_json", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("state", sa.String(length=40), nullable=False, server_default="CREATED"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("offers_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("offers_discarded_prefilter", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("offers_analyzed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("result_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ai_calls", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_agent_runs_user_id", "agent_runs", ["user_id"])
    op.create_index("ix_agent_runs_state", "agent_runs", ["state"])
    op.create_index("ix_agent_runs_created_at", "agent_runs", ["created_at"])


def downgrade():
    op.drop_index("ix_agent_runs_created_at", table_name="agent_runs")
    op.drop_index("ix_agent_runs_state", table_name="agent_runs")
    op.drop_index("ix_agent_runs_user_id", table_name="agent_runs")
    op.drop_table("agent_runs")
