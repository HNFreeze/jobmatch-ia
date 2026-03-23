"""add offer signal cache to job offers

Revision ID: n8b2d4f6a1c3
Revises: m7a9c1e3b5d7
Create Date: 2026-03-23 15:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "n8b2d4f6a1c3"
down_revision = "m7a9c1e3b5d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_offers", sa.Column("analysis_version", sa.String(length=50), nullable=True))
    op.add_column("job_offers", sa.Column("analysis_hash", sa.String(length=64), nullable=True))
    op.add_column("job_offers", sa.Column("offer_signals_json", sa.Text(), nullable=True))
    op.add_column("job_offers", sa.Column("signals_updated_at", sa.DateTime(), nullable=True))
    op.create_index("ix_job_offers_analysis_hash", "job_offers", ["analysis_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_job_offers_analysis_hash", table_name="job_offers")
    op.drop_column("job_offers", "signals_updated_at")
    op.drop_column("job_offers", "offer_signals_json")
    op.drop_column("job_offers", "analysis_hash")
    op.drop_column("job_offers", "analysis_version")
