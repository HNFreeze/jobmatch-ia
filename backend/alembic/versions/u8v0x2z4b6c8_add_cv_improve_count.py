"""add cv_improve_count to ai_daily_usage

Revision ID: u8v0x2z4b6c8
Revises: s6t8v0x2z4b6
Create Date: 2026-03-31 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "u8v0x2z4b6c8"
down_revision = "s6t8v0x2z4b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_daily_usage",
        sa.Column("cv_improve_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("ai_daily_usage", "cv_improve_count")
