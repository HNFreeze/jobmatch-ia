"""cv module upgrade: ats_results, improvements, is_super_admin

Revision ID: v9w1y3a5c7e9
Revises: u8v0x2z4b6c8
Create Date: 2026-03-31 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "v9w1y3a5c7e9"
down_revision = "u8v0x2z4b6c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Tabla cv_ats_results ──────────────────────────────────────────────────
    op.create_table(
        "cv_ats_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("cv_text_hash", sa.String(length=64), nullable=False),
        sa.Column("original_cv_text", sa.Text(), nullable=False),
        sa.Column("ats_score_before", sa.Integer(), nullable=False),
        sa.Column("feedback_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cv_ats_results_id", "cv_ats_results", ["id"], unique=False)
    op.create_index("ix_cv_ats_results_user_id", "cv_ats_results", ["user_id"], unique=False)
    op.create_index("ix_cv_ats_results_hash", "cv_ats_results", ["cv_text_hash"], unique=False)

    # ── Tabla cv_improvements ─────────────────────────────────────────────────
    op.create_table(
        "cv_improvements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ats_result_id", sa.Integer(), sa.ForeignKey("cv_ats_results.id"), nullable=True),
        sa.Column("improved_cv_text", sa.Text(), nullable=False),
        sa.Column("ats_score_before", sa.Integer(), nullable=False),
        sa.Column("ats_score_after", sa.Integer(), nullable=False),
        sa.Column("meta_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cv_improvements_id", "cv_improvements", ["id"], unique=False)
    op.create_index("ix_cv_improvements_user_id", "cv_improvements", ["user_id"], unique=False)

    # ── is_super_admin en users ───────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("users", "is_super_admin")
    op.drop_index("ix_cv_improvements_user_id", table_name="cv_improvements")
    op.drop_index("ix_cv_improvements_id", table_name="cv_improvements")
    op.drop_table("cv_improvements")
    op.drop_index("ix_cv_ats_results_hash", table_name="cv_ats_results")
    op.drop_index("ix_cv_ats_results_user_id", table_name="cv_ats_results")
    op.drop_index("ix_cv_ats_results_id", table_name="cv_ats_results")
    op.drop_table("cv_ats_results")
