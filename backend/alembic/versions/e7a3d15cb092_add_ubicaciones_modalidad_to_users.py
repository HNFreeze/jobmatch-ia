"""add ubicaciones and modalidad to users

Revision ID: e7a3d15cb092
Revises: b3e1a92cf8d4
Create Date: 2026-03-20 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7a3d15cb092'
down_revision: Union[str, Sequence[str], None] = 'b3e1a92cf8d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('ubicaciones', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('modalidad', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'ubicaciones')
    op.drop_column('users', 'modalidad')
