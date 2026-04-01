"""cv structured json + edit sessions

Revision ID: w0x2z4b6d8f0
Revises: v9w1y3a5c7e9
Create Date: 2026-04-01 12:00:00

"""
from alembic import op
import sqlalchemy as sa

revision = "w0x2z4b6d8f0"
down_revision = "v9w1y3a5c7e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Columna cv_structured_json en cv_improvements (nullable para retrocompat)
    op.add_column(
        "cv_improvements",
        sa.Column("cv_structured_json", sa.Text(), nullable=True),
    )

    # Nueva tabla cv_edit_sessions
    op.create_table(
        "cv_edit_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("improvement_id", sa.Integer(), nullable=False),
        sa.Column("edited_cv_json", sa.Text(), nullable=False),
        sa.Column("action_log_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["improvement_id"], ["cv_improvements.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cv_edit_sessions_id", "cv_edit_sessions", ["id"])
    op.create_index("ix_cv_edit_sessions_user_id", "cv_edit_sessions", ["user_id"])
    op.create_index("ix_cv_edit_sessions_improvement_id", "cv_edit_sessions", ["improvement_id"])


def downgrade() -> None:
    op.drop_index("ix_cv_edit_sessions_improvement_id", table_name="cv_edit_sessions")
    op.drop_index("ix_cv_edit_sessions_user_id", table_name="cv_edit_sessions")
    op.drop_index("ix_cv_edit_sessions_id", table_name="cv_edit_sessions")
    op.drop_table("cv_edit_sessions")
    op.drop_column("cv_improvements", "cv_structured_json")
