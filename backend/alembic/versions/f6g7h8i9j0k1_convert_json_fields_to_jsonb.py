# -*- coding: utf-8 -*-
"""convert json text fields to jsonb

Revision ID: f6g7h8i9j0k1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-31
"""
from alembic import op

revision = "f6g7h8i9j0k1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    # users table
    for col in ("stack", "idiomas", "ubicaciones", "modalidad", "stack_years"):
        op.execute(
            f"ALTER TABLE users ALTER COLUMN {col} TYPE JSONB "
            f"USING NULLIF({col}, '')::jsonb"
        )

    # interview_sessions table.
    # conversation_json has a TEXT server_default ('[]') that Postgres cannot
    # auto-cast during ALTER TYPE, so drop the default first, convert, then
    # re-add it as a jsonb default. feedback_json is nullable with no default.
    op.execute("ALTER TABLE interview_sessions ALTER COLUMN conversation_json DROP DEFAULT")
    op.execute(
        "ALTER TABLE interview_sessions ALTER COLUMN conversation_json TYPE JSONB "
        "USING NULLIF(conversation_json, '')::jsonb"
    )
    op.execute("ALTER TABLE interview_sessions ALTER COLUMN conversation_json SET DEFAULT '[]'::jsonb")
    op.execute(
        "ALTER TABLE interview_sessions ALTER COLUMN feedback_json TYPE JSONB "
        "USING NULLIF(feedback_json, '')::jsonb"
    )

    # historial_busquedas table (SearchHistory)
    for col in ("stack", "ubicaciones", "modalidad"):
        op.execute(
            f"ALTER TABLE historial_busquedas ALTER COLUMN {col} TYPE JSONB "
            f"USING NULLIF({col}, '')::jsonb"
        )

    # GIN indexes for most-queried JSONB columns
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_stack_gin ON users USING gin(stack)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_historial_stack_gin ON historial_busquedas USING gin(stack)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_users_stack_gin")
    op.execute("DROP INDEX IF EXISTS ix_historial_stack_gin")

    for col in ("stack", "idiomas", "ubicaciones", "modalidad", "stack_years"):
        op.execute(
            f"ALTER TABLE users ALTER COLUMN {col} TYPE TEXT "
            f"USING {col}::text"
        )

    op.execute("ALTER TABLE interview_sessions ALTER COLUMN conversation_json DROP DEFAULT")
    op.execute(
        "ALTER TABLE interview_sessions ALTER COLUMN conversation_json TYPE TEXT "
        "USING conversation_json::text"
    )
    op.execute("ALTER TABLE interview_sessions ALTER COLUMN conversation_json SET DEFAULT '[]'")
    op.execute(
        "ALTER TABLE interview_sessions ALTER COLUMN feedback_json TYPE TEXT "
        "USING feedback_json::text"
    )

    for col in ("stack", "ubicaciones", "modalidad"):
        op.execute(
            f"ALTER TABLE historial_busquedas ALTER COLUMN {col} TYPE TEXT "
            f"USING {col}::text"
        )
