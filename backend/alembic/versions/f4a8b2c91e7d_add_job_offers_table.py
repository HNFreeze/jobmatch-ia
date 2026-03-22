"""add job_offers table

Revision ID: f4a8b2c91e7d
Revises: e7a3d15cb092
Create Date: 2026-03-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f4a8b2c91e7d'
down_revision = 'e7a3d15cb092'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'job_offers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('adzuna_id', sa.String(length=100), nullable=False),
        sa.Column('titulo', sa.String(length=500), nullable=True),
        sa.Column('empresa', sa.String(length=300), nullable=True),
        sa.Column('ubicacion', sa.String(length=300), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('salario', sa.String(length=200), nullable=True),
        sa.Column('fecha_publicacion', sa.String(length=50), nullable=True),
        sa.Column('url', sa.String(length=2000), nullable=True),
        sa.Column('skills_detectadas', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_job_offers_id', 'job_offers', ['id'], unique=False)
    op.create_index('ix_job_offers_adzuna_id', 'job_offers', ['adzuna_id'], unique=True)


def downgrade():
    op.drop_index('ix_job_offers_adzuna_id', table_name='job_offers')
    op.drop_index('ix_job_offers_id', table_name='job_offers')
    op.drop_table('job_offers')
