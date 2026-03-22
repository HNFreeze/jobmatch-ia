"""add alias nombre apellidos to users

Revision ID: c1d2e3f4a5b6
Revises: e7a3d15cb092
Create Date: 2026-03-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'a9c3e5f7b1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('alias', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('nombre', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('apellidos', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'alias')
    op.drop_column('users', 'nombre')
    op.drop_column('users', 'apellidos')
