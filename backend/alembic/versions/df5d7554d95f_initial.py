"""initial

Revision ID: df5d7554d95f
Revises: 
Create Date: 2026-03-20 15:46:05.775626

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df5d7554d95f'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("anos_experiencia", sa.String(50), nullable=True),
        sa.Column("stack", sa.Text(), nullable=True),
        sa.Column("ingles", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "search_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("perfil_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("ofertas_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_search_cache_perfil_hash", "search_cache", ["perfil_hash"])


def downgrade() -> None:
    op.drop_index("ix_search_cache_perfil_hash", table_name="search_cache")
    op.drop_table("search_cache")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
