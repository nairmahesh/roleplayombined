"""Add TeamRoleplay table for manager-created shared scenarios

Revision ID: 003c4d5e6f7g
Revises: 002b3c4d5e6f
Create Date: 2026-04-25 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op


revision: str = "003c4d5e6f7g"
down_revision: Union[str, None] = "002b3c4d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS "TeamRoleplay" (
            "id"             VARCHAR PRIMARY KEY,
            "companyId"      VARCHAR NOT NULL REFERENCES "Company"("id"),
            "createdById"    VARCHAR NOT NULL REFERENCES "User"("id"),
            "name"           VARCHAR(255) NOT NULL,
            "description"    TEXT,
            "scenarioConfig" TEXT NOT NULL,
            "isActive"       BOOLEAN NOT NULL DEFAULT true,
            "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute('CREATE INDEX IF NOT EXISTS "ix_teamroleplay_company" ON "TeamRoleplay" ("companyId")')
    op.execute('CREATE INDEX IF NOT EXISTS "ix_teamroleplay_creator" ON "TeamRoleplay" ("createdById")')


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS "TeamRoleplay"')
