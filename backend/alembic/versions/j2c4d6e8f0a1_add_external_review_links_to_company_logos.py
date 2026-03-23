"""add external review links to company_logos

Revision ID: j2c4d6e8f0a1
Revises: h1b2c3d4e5f6
Create Date: 2026-03-23 18:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "j2c4d6e8f0a1"
down_revision = "h1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("company_logos", sa.Column("glassdoor_url", sa.String(length=2000), nullable=True))
    op.add_column("company_logos", sa.Column("kununu_url", sa.String(length=2000), nullable=True))
    op.add_column("company_logos", sa.Column("trustpilot_url", sa.String(length=2000), nullable=True))
    op.add_column(
        "company_logos",
        sa.Column("review_status", sa.String(length=20), server_default="unavailable", nullable=False),
    )
    op.add_column("company_logos", sa.Column("review_checked_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("company_logos", "review_checked_at")
    op.drop_column("company_logos", "review_status")
    op.drop_column("company_logos", "trustpilot_url")
    op.drop_column("company_logos", "kununu_url")
    op.drop_column("company_logos", "glassdoor_url")
