"""add rating cols to company logos

Revision ID: g8d5c4b3a1d9
Revises: f7c4b3a1d902
Create Date: 2026-03-23 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g8d5c4b3a1d9"
down_revision: Union[str, Sequence[str], None] = "f7c4b3a1d902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("company_logos", sa.Column("rating_value", sa.Float(), nullable=True))
    op.add_column("company_logos", sa.Column("rating_count", sa.Integer(), nullable=True))
    op.add_column("company_logos", sa.Column("rating_source", sa.String(length=100), nullable=True))
    op.add_column("company_logos", sa.Column("rating_status", sa.String(length=20), server_default="pending", nullable=False))


def downgrade() -> None:
    op.drop_column("company_logos", "rating_status")
    op.drop_column("company_logos", "rating_source")
    op.drop_column("company_logos", "rating_count")
    op.drop_column("company_logos", "rating_value")
