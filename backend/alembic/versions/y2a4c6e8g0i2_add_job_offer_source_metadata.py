"""add job offer source metadata

Revision ID: y2a4c6e8g0i2
Revises: x1y3z5a7c9e1
Create Date: 2026-04-02 18:05:00

"""
from alembic import op
import sqlalchemy as sa


revision = "y2a4c6e8g0i2"
down_revision = "x1y3z5a7c9e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_offers", sa.Column("source_name", sa.String(length=100), nullable=True))
    op.add_column("job_offers", sa.Column("source_type", sa.String(length=50), nullable=True))
    op.add_column("job_offers", sa.Column("source_job_id", sa.String(length=200), nullable=True))
    op.add_column("job_offers", sa.Column("source_confidence", sa.Float(), nullable=True, server_default=sa.text("0.58")))
    op.add_column("job_offers", sa.Column("source_metadata_json", sa.Text(), nullable=True))
    op.add_column("job_offers", sa.Column("raw_payload_json", sa.Text(), nullable=True))
    op.add_column("job_offers", sa.Column("canonical_url", sa.String(length=2000), nullable=True))
    op.add_column("job_offers", sa.Column("canonical_company", sa.String(length=300), nullable=True))
    op.add_column("job_offers", sa.Column("first_seen_at", sa.DateTime(), nullable=True))
    op.add_column("job_offers", sa.Column("last_seen_at", sa.DateTime(), nullable=True))
    op.add_column("job_offers", sa.Column("last_verified_at", sa.DateTime(), nullable=True))
    op.add_column("job_offers", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

    op.execute("UPDATE job_offers SET source_name = 'adzuna' WHERE source_name IS NULL")
    op.execute("UPDATE job_offers SET source_type = 'aggregator' WHERE source_type IS NULL")
    op.execute("UPDATE job_offers SET source_job_id = adzuna_id WHERE source_job_id IS NULL")
    op.execute("UPDATE job_offers SET canonical_url = url WHERE canonical_url IS NULL")
    op.execute("UPDATE job_offers SET canonical_company = empresa WHERE canonical_company IS NULL")
    op.execute("UPDATE job_offers SET first_seen_at = created_at WHERE first_seen_at IS NULL")
    op.execute("UPDATE job_offers SET last_seen_at = created_at WHERE last_seen_at IS NULL")
    op.execute("UPDATE job_offers SET last_verified_at = created_at WHERE last_verified_at IS NULL")
    op.execute("UPDATE job_offers SET is_active = true WHERE is_active IS NULL")

    op.alter_column("job_offers", "source_confidence", server_default=None)
    op.alter_column("job_offers", "is_active", server_default=None)

    op.create_index("ix_job_offers_source_name", "job_offers", ["source_name"])
    op.create_index("ix_job_offers_source_type", "job_offers", ["source_type"])
    op.create_index("ix_job_offers_source_job_id", "job_offers", ["source_job_id"])
    op.create_index("ix_job_offers_canonical_company", "job_offers", ["canonical_company"])
    op.create_index("ix_job_offers_last_seen_at", "job_offers", ["last_seen_at"])
    op.create_index("ix_job_offers_is_active", "job_offers", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_job_offers_is_active", table_name="job_offers")
    op.drop_index("ix_job_offers_last_seen_at", table_name="job_offers")
    op.drop_index("ix_job_offers_canonical_company", table_name="job_offers")
    op.drop_index("ix_job_offers_source_job_id", table_name="job_offers")
    op.drop_index("ix_job_offers_source_type", table_name="job_offers")
    op.drop_index("ix_job_offers_source_name", table_name="job_offers")

    op.drop_column("job_offers", "is_active")
    op.drop_column("job_offers", "last_verified_at")
    op.drop_column("job_offers", "last_seen_at")
    op.drop_column("job_offers", "first_seen_at")
    op.drop_column("job_offers", "canonical_company")
    op.drop_column("job_offers", "canonical_url")
    op.drop_column("job_offers", "raw_payload_json")
    op.drop_column("job_offers", "source_metadata_json")
    op.drop_column("job_offers", "source_confidence")
    op.drop_column("job_offers", "source_job_id")
    op.drop_column("job_offers", "source_type")
    op.drop_column("job_offers", "source_name")
