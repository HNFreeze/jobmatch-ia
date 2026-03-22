"""add security and quota tables

Revision ID: a8e6c4d2f901
Revises: f7c4b3a1d902
Create Date: 2026-03-22 20:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8e6c4d2f901"
down_revision: Union[str, Sequence[str], None] = "f7c4b3a1d902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("daily_ai_quota", sa.Integer(), nullable=False, server_default="8"))

    op.execute("UPDATE users SET email_verified = true, email_verified_at = created_at WHERE email IS NOT NULL")

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_email_verification_tokens_id"), "email_verification_tokens", ["id"], unique=False)
    op.create_index(op.f("ix_email_verification_tokens_user_id"), "email_verification_tokens", ["user_id"], unique=False)
    op.create_index(op.f("ix_email_verification_tokens_token_hash"), "email_verification_tokens", ["token_hash"], unique=True)

    op.create_table(
        "rate_limit_buckets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("bucket_key", sa.String(length=255), nullable=False),
        sa.Column("window_start", sa.DateTime(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("action", "bucket_key", "window_start", name="uq_rate_limit_bucket"),
    )
    op.create_index(op.f("ix_rate_limit_buckets_id"), "rate_limit_buckets", ["id"], unique=False)
    op.create_index(op.f("ix_rate_limit_buckets_action"), "rate_limit_buckets", ["action"], unique=False)
    op.create_index(op.f("ix_rate_limit_buckets_bucket_key"), "rate_limit_buckets", ["bucket_key"], unique=False)
    op.create_index(op.f("ix_rate_limit_buckets_window_start"), "rate_limit_buckets", ["window_start"], unique=False)

    op.create_table(
        "ai_daily_usage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("match_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cover_letter_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_units", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_ai_daily_usage_user_date"),
    )
    op.create_index(op.f("ix_ai_daily_usage_id"), "ai_daily_usage", ["id"], unique=False)
    op.create_index(op.f("ix_ai_daily_usage_user_id"), "ai_daily_usage", ["user_id"], unique=False)
    op.create_index(op.f("ix_ai_daily_usage_usage_date"), "ai_daily_usage", ["usage_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_daily_usage_usage_date"), table_name="ai_daily_usage")
    op.drop_index(op.f("ix_ai_daily_usage_user_id"), table_name="ai_daily_usage")
    op.drop_index(op.f("ix_ai_daily_usage_id"), table_name="ai_daily_usage")
    op.drop_table("ai_daily_usage")

    op.drop_index(op.f("ix_rate_limit_buckets_window_start"), table_name="rate_limit_buckets")
    op.drop_index(op.f("ix_rate_limit_buckets_bucket_key"), table_name="rate_limit_buckets")
    op.drop_index(op.f("ix_rate_limit_buckets_action"), table_name="rate_limit_buckets")
    op.drop_index(op.f("ix_rate_limit_buckets_id"), table_name="rate_limit_buckets")
    op.drop_table("rate_limit_buckets")

    op.drop_index(op.f("ix_email_verification_tokens_token_hash"), table_name="email_verification_tokens")
    op.drop_index(op.f("ix_email_verification_tokens_user_id"), table_name="email_verification_tokens")
    op.drop_index(op.f("ix_email_verification_tokens_id"), table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")

    op.drop_column("users", "daily_ai_quota")
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "email_verified")
