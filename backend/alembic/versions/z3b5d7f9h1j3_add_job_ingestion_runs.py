"""add job ingestion runs

Revision ID: z3b5d7f9h1j3
Revises: y2a4c6e8g0i2
Create Date: 2026-04-02 20:10:00

"""
from alembic import op
import sqlalchemy as sa


revision = "z3b5d7f9h1j3"
down_revision = "y2a4c6e8g0i2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_ingestion_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("triggered_by_user_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("trigger_mode", sa.String(length=40), nullable=False, server_default="manual"),
        sa.Column("requested_sources_json", sa.Text(), nullable=True),
        sa.Column("requested_skills_json", sa.Text(), nullable=True),
        sa.Column("requested_locations_json", sa.Text(), nullable=True),
        sa.Column("log_lines_json", sa.Text(), nullable=True),
        sa.Column("stats_json", sa.Text(), nullable=True),
        sa.Column("fetched_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("saved_new_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("saved_updated_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("inactive_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["triggered_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_ingestion_runs_id", "job_ingestion_runs", ["id"])
    op.create_index("ix_job_ingestion_runs_triggered_by_user_id", "job_ingestion_runs", ["triggered_by_user_id"])
    op.create_index("ix_job_ingestion_runs_status", "job_ingestion_runs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_job_ingestion_runs_status", table_name="job_ingestion_runs")
    op.drop_index("ix_job_ingestion_runs_triggered_by_user_id", table_name="job_ingestion_runs")
    op.drop_index("ix_job_ingestion_runs_id", table_name="job_ingestion_runs")
    op.drop_table("job_ingestion_runs")
