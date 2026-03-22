"""add idiomas to users

Revision ID: b3e1a92cf8d4
Revises: df5d7554d95f
Create Date: 2026-03-20 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3e1a92cf8d4'
down_revision: Union[str, Sequence[str], None] = 'df5d7554d95f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('idiomas', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'idiomas')
