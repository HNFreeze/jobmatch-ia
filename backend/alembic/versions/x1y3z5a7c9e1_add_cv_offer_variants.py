"""add cv offer variants

Revision ID: x1y3z5a7c9e1
Revises: w0x2z4b6d8f0
Create Date: 2026-04-02 10:30:00

"""
from alembic import op
import sqlalchemy as sa


revision = "x1y3z5a7c9e1"
down_revision = "w0x2z4b6d8f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cv_offer_variants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("improvement_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("offer_adzuna_id", sa.String(length=100), nullable=True),
        sa.Column("offer_title", sa.String(length=500), nullable=True),
        sa.Column("offer_company", sa.String(length=300), nullable=True),
        sa.Column("offer_url", sa.String(length=2000), nullable=True),
        sa.Column("offer_snapshot_json", sa.Text(), nullable=True),
        sa.Column("edited_cv_json", sa.Text(), nullable=False),
        sa.Column("action_log_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["improvement_id"], ["cv_improvements.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cv_offer_variants_id", "cv_offer_variants", ["id"])
    op.create_index("ix_cv_offer_variants_user_id", "cv_offer_variants", ["user_id"])
    op.create_index("ix_cv_offer_variants_improvement_id", "cv_offer_variants", ["improvement_id"])
    op.create_index("ix_cv_offer_variants_offer_adzuna_id", "cv_offer_variants", ["offer_adzuna_id"])


def downgrade() -> None:
    op.drop_index("ix_cv_offer_variants_offer_adzuna_id", table_name="cv_offer_variants")
    op.drop_index("ix_cv_offer_variants_improvement_id", table_name="cv_offer_variants")
    op.drop_index("ix_cv_offer_variants_user_id", table_name="cv_offer_variants")
    op.drop_index("ix_cv_offer_variants_id", table_name="cv_offer_variants")
    op.drop_table("cv_offer_variants")
