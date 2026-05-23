# -*- coding: utf-8 -*-
"""add interview feature

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "interview_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id"), nullable=True),
        sa.Column("job_title", sa.String(500), nullable=False),
        sa.Column("company", sa.String(500), nullable=False, server_default=""),
        sa.Column("job_description", sa.Text(), nullable=True),
        sa.Column("conversation_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("feedback_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_interview_sessions_id", "interview_sessions", ["id"])
    op.create_index("ix_interview_sessions_user_id", "interview_sessions", ["user_id"])

    op.add_column(
        "ai_daily_usage",
        sa.Column("interview_count", sa.Integer(), nullable=True, server_default="0"),
    )


def downgrade():
    op.drop_column("ai_daily_usage", "interview_count")
    op.drop_index("ix_interview_sessions_user_id", table_name="interview_sessions")
    op.drop_index("ix_interview_sessions_id", table_name="interview_sessions")
    op.drop_table("interview_sessions")
