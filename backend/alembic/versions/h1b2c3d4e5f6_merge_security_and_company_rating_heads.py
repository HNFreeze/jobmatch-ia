"""merge security/quota and company rating heads

Revision ID: h1b2c3d4e5f6
Revises: a8e6c4d2f901, g8d5c4b3a1d9
Create Date: 2026-03-23 19:15:00.000000

"""
from typing import Sequence, Union


revision: str = "h1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = ("a8e6c4d2f901", "g8d5c4b3a1d9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
