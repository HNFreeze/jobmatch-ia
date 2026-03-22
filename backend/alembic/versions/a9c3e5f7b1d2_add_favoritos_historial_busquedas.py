"""add favoritos and historial_busquedas tables

Revision ID: a9c3e5f7b1d2
Revises: f4a8b2c91e7d
Create Date: 2026-03-21 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9c3e5f7b1d2'
down_revision = 'f4a8b2c91e7d'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'favoritos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('adzuna_id', sa.String(length=100), nullable=False),
        sa.Column('titulo', sa.String(length=500), nullable=True),
        sa.Column('empresa', sa.String(length=300), nullable=True),
        sa.Column('url', sa.String(length=2000), nullable=True),
        sa.Column('resultado_ia', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'adzuna_id', name='uq_favoritos_user_adzuna'),
    )
    op.create_index('ix_favoritos_id', 'favoritos', ['id'], unique=False)
    op.create_index('ix_favoritos_user_id', 'favoritos', ['user_id'], unique=False)

    op.create_table(
        'historial_busquedas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('stack', sa.Text(), nullable=True),
        sa.Column('anos_experiencia', sa.String(length=50), nullable=True),
        sa.Column('ubicaciones', sa.Text(), nullable=True),
        sa.Column('modalidad', sa.Text(), nullable=True),
        sa.Column('num_aplica', sa.Integer(), nullable=True),
        sa.Column('num_quiza', sa.Integer(), nullable=True),
        sa.Column('num_no_encaja', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_historial_busquedas_id', 'historial_busquedas', ['id'], unique=False)
    op.create_index('ix_historial_busquedas_user_id', 'historial_busquedas', ['user_id'], unique=False)


def downgrade():
    op.drop_index('ix_historial_busquedas_user_id', table_name='historial_busquedas')
    op.drop_index('ix_historial_busquedas_id', table_name='historial_busquedas')
    op.drop_table('historial_busquedas')

    op.drop_index('ix_favoritos_user_id', table_name='favoritos')
    op.drop_index('ix_favoritos_id', table_name='favoritos')
    op.drop_table('favoritos')
