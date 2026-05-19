"""Add company extended fields for super admin management

Revision ID: 001a2b3c4d5e
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "001a2b3c4d5e"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use IF NOT EXISTS so the migration is idempotent (safe to re-run)
    op.execute('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true')
    op.execute('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "industry" VARCHAR(100)')
    op.execute('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "contactEmail" VARCHAR(255)')
    op.execute('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "contactPhone" VARCHAR(50)')
    op.execute('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "registrationInfo" TEXT')


def downgrade() -> None:
    op.drop_column("Company", "registrationInfo")
    op.drop_column("Company", "contactPhone")
    op.drop_column("Company", "contactEmail")
    op.drop_column("Company", "industry")
    op.drop_column("Company", "isActive")
