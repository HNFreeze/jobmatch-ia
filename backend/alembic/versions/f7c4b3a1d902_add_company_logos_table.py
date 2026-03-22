"""add company_logos table

Revision ID: f7c4b3a1d902
Revises: d1286330359d, a9c3e5f7b1d2
Create Date: 2026-03-22 21:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7c4b3a1d902"
down_revision: Union[str, Sequence[str], None] = ("d1286330359d", "a9c3e5f7b1d2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "company_logos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_name_original", sa.String(length=300), nullable=False),
        sa.Column("company_name_normalized", sa.String(length=300), nullable=False),
        sa.Column("resolved_domain", sa.String(length=255), nullable=True),
        sa.Column("logo_url", sa.String(length=2000), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_name_normalized"),
    )
    op.create_index(op.f("ix_company_logos_id"), "company_logos", ["id"], unique=False)
    op.create_index(
        op.f("ix_company_logos_company_name_normalized"),
        "company_logos",
        ["company_name_normalized"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_company_logos_company_name_normalized"), table_name="company_logos")
    op.drop_index(op.f("ix_company_logos_id"), table_name="company_logos")
    op.drop_table("company_logos")
