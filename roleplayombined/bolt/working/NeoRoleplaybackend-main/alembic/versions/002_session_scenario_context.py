"""Add scenarioContext to Session and make personaId nullable

Revision ID: 002b3c4d5e6f
Revises: 001a2b3c4d5e
Create Date: 2026-04-25 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op


revision: str = "002b3c4d5e6f"
down_revision: Union[str, None] = "001a2b3c4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "scenarioContext" TEXT')
    op.execute('ALTER TABLE "Session" ALTER COLUMN "personaId" DROP NOT NULL')


def downgrade() -> None:
    op.execute('ALTER TABLE "Session" DROP COLUMN IF EXISTS "scenarioContext"')
