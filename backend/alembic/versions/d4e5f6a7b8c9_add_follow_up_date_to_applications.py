# -*- coding: utf-8 -*-
"""add follow_up_date to applications

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("applications", sa.Column("follow_up_date", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("applications", "follow_up_date")
