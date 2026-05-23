# -*- coding: utf-8 -*-
"""add stack_years to users

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-14

"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stack_years", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "stack_years")
