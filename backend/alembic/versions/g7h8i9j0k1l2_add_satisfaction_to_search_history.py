# -*- coding: utf-8 -*-
"""add satisfaction fields to search history

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-05-31
"""
from alembic import op
import sqlalchemy as sa

revision = "g7h8i9j0k1l2"
down_revision = "f6g7h8i9j0k1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("historial_busquedas", sa.Column("satisfaction_rating", sa.Integer(), nullable=True))
    op.add_column("historial_busquedas", sa.Column("satisfaction_comment", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("historial_busquedas", "satisfaction_comment")
    op.drop_column("historial_busquedas", "satisfaction_rating")
