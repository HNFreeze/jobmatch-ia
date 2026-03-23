"""add ai api cost events

Revision ID: q4f6h8j0k2l4
Revises: n8b2d4f6a1c3
Create Date: 2026-03-23 18:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "q4f6h8j0k2l4"
down_revision = "n8b2d4f6a1c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_api_cost_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("feature", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("request_id", sa.String(length=120), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_creation_input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cache_read_input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_api_cost_events_id"), "ai_api_cost_events", ["id"], unique=False)
    op.create_index(op.f("ix_ai_api_cost_events_user_id"), "ai_api_cost_events", ["user_id"], unique=False)
    op.create_index(op.f("ix_ai_api_cost_events_feature"), "ai_api_cost_events", ["feature"], unique=False)
    op.create_index(op.f("ix_ai_api_cost_events_model"), "ai_api_cost_events", ["model"], unique=False)
    op.create_index(op.f("ix_ai_api_cost_events_created_at"), "ai_api_cost_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_api_cost_events_created_at"), table_name="ai_api_cost_events")
    op.drop_index(op.f("ix_ai_api_cost_events_model"), table_name="ai_api_cost_events")
    op.drop_index(op.f("ix_ai_api_cost_events_feature"), table_name="ai_api_cost_events")
    op.drop_index(op.f("ix_ai_api_cost_events_user_id"), table_name="ai_api_cost_events")
    op.drop_index(op.f("ix_ai_api_cost_events_id"), table_name="ai_api_cost_events")
    op.drop_table("ai_api_cost_events")
