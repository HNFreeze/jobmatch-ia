"""add blocking fields to users

Revision ID: m7a9c1e3b5d7
Revises: k4e6f8a0b2c3
Create Date: 2026-03-23 13:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "m7a9c1e3b5d7"
down_revision = "k4e6f8a0b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("blocked_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "blocked_at")
    op.drop_column("users", "is_blocked")
