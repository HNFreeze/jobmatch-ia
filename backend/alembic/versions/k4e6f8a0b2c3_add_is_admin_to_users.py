"""add is_admin to users

Revision ID: k4e6f8a0b2c3
Revises: j2c4d6e8f0a1
Create Date: 2026-03-23 19:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "k4e6f8a0b2c3"
down_revision = "j2c4d6e8f0a1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade():
    op.drop_column("users", "is_admin")
