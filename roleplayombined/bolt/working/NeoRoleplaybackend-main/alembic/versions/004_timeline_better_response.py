"""Add betterResponse column to TimelineEvent

Revision ID: 004d5e6f7g8h
Revises: 003c4d5e6f7g
Create Date: 2026-05-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '004d5e6f7g8h'
down_revision = '003c4d5e6f7g'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make migration idempotent: some DBs may already have this column.
    op.execute(
        sa.text(
            'ALTER TABLE "TimelineEvent" '
            'ADD COLUMN IF NOT EXISTS "betterResponse" TEXT'
        )
    )


def downgrade() -> None:
    op.execute(sa.text('ALTER TABLE "TimelineEvent" DROP COLUMN IF EXISTS "betterResponse"'))
