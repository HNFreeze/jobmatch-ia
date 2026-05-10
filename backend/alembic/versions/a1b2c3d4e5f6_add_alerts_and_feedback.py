"""add job alerts and match feedback

Revision ID: a1b2c3d4e5f6
Revises: z3b5d7f9h1j3
Create Date: 2026-05-10 19:45:00

"""
from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = "z3b5d7f9h1j3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── job_alerts ────────────────────────────────────────────────────────────
    op.create_table(
        "job_alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("min_score_threshold", sa.Integer(), nullable=False, server_default="70"),
        sa.Column("email_frequency", sa.String(length=20), nullable=False, server_default="daily"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_triggered_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_alerts_id", "job_alerts", ["id"])
    op.create_index("ix_job_alerts_user_id", "job_alerts", ["user_id"])
    op.create_index("ix_job_alerts_is_active", "job_alerts", ["is_active"])

    # ── match_feedback ────────────────────────────────────────────────────────
    op.create_table(
        "match_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("adzuna_id", sa.String(length=255), nullable=False),
        sa.Column("rating", sa.String(length=10), nullable=False),
        sa.Column("offer_score", sa.Integer(), nullable=True),
        sa.Column("offer_result", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_match_feedback_id", "match_feedback", ["id"])
    op.create_index("ix_match_feedback_user_id", "match_feedback", ["user_id"])
    op.create_index("ix_match_feedback_adzuna_id", "match_feedback", ["adzuna_id"])


def downgrade() -> None:
    op.drop_index("ix_match_feedback_adzuna_id", table_name="match_feedback")
    op.drop_index("ix_match_feedback_user_id", table_name="match_feedback")
    op.drop_index("ix_match_feedback_id", table_name="match_feedback")
    op.drop_table("match_feedback")

    op.drop_index("ix_job_alerts_is_active", table_name="job_alerts")
    op.drop_index("ix_job_alerts_user_id", table_name="job_alerts")
    op.drop_index("ix_job_alerts_id", table_name="job_alerts")
    op.drop_table("job_alerts")
