"""add cv_analyses table and cv_analysis_count to ai_daily_usage

Revision ID: s6t8v0x2z4b6
Revises: r5g7i9k1m3o5
Create Date: 2026-03-30 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "s6t8v0x2z4b6"
down_revision = "r5g7i9k1m3o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tabla principal de análisis de CV
    op.create_table(
        "cv_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename_original", sa.String(length=255), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("structured_profile_json", sa.Text(), nullable=False),
        sa.Column("is_latest", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("ai_model", sa.String(length=120), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cv_analyses_id"), "cv_analyses", ["id"], unique=False)
    op.create_index(op.f("ix_cv_analyses_user_id"), "cv_analyses", ["user_id"], unique=False)

    # Nuevo contador de análisis de CV en la tabla de cuotas diarias
    op.add_column(
        "ai_daily_usage",
        sa.Column("cv_analysis_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("ai_daily_usage", "cv_analysis_count")
    op.drop_index(op.f("ix_cv_analyses_user_id"), table_name="cv_analyses")
    op.drop_index(op.f("ix_cv_analyses_id"), table_name="cv_analyses")
    op.drop_table("cv_analyses")
