"""add analytics_consent to users

Revision ID: r5g7i9k1m3o5
Revises: q4f6h8j0k2l4
Create Date: 2026-03-24 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "r5g7i9k1m3o5"
down_revision = "q4f6h8j0k2l4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("analytics_consent", sa.Boolean(), nullable=True),
    )


def downgrade():
    op.drop_column("users", "analytics_consent")
