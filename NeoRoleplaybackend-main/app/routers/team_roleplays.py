import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DB
from app.models.team_roleplay import TeamRoleplay
from app.models.enums import UserRole

router = APIRouter(prefix="/team-roleplays", tags=["team-roleplays"])

_MANAGER_ROLES = {UserRole.MANAGER, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN}


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreatedByMinimal(BaseModel):
    id: str
    firstName: str
    lastName: str

    model_config = {"from_attributes": True}


class TeamRoleplayResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    scenarioConfig: dict
    isActive: bool
    createdById: str
    createdBy: CreatedByMinimal
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}


class CreateTeamRoleplayRequest(BaseModel):
    name: str
    description: Optional[str] = None
    scenarioConfig: dict


class UpdateTeamRoleplayRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    scenarioConfig: Optional[dict] = None
    isActive: Optional[bool] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_response(tr: TeamRoleplay) -> dict:
    return {
        "id": tr.id,
        "name": tr.name,
        "description": tr.description,
        "scenarioConfig": json.loads(tr.scenarioConfig),
        "isActive": tr.isActive,
        "createdById": tr.createdById,
        "createdBy": {
            "id": tr.createdBy.id,
            "firstName": tr.createdBy.firstName,
            "lastName": tr.createdBy.lastName,
        },
        "createdAt": tr.createdAt,
        "updatedAt": tr.updatedAt,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_team_roleplays(
    current_user: CurrentUser,
    db: DB,
):
    """All active team roleplays for the user's company — visible to every role."""
    result = await db.execute(
        select(TeamRoleplay)
        .options(selectinload(TeamRoleplay.createdBy))
        .where(
            TeamRoleplay.companyId == current_user.companyId,
            TeamRoleplay.isActive == True,
        )
        .order_by(TeamRoleplay.createdAt.desc())
    )
    roleplays = result.scalars().all()
    return [_build_response(tr) for tr in roleplays]


@router.post("", status_code=201)
async def create_team_roleplay(
    body: CreateTeamRoleplayRequest,
    current_user: CurrentUser,
    db: DB,
):
    """Create a team roleplay. Requires MANAGER, COMPANY_ADMIN, or SUPER_ADMIN."""
    if current_user.role not in _MANAGER_ROLES:
        raise HTTPException(403, "Only managers and admins can create team roleplays")

    if not body.name.strip():
        raise HTTPException(400, "Name is required")

    tr = TeamRoleplay(
        id=str(uuid.uuid4()),
        companyId=current_user.companyId,
        createdById=current_user.id,
        name=body.name.strip(),
        description=(body.description or "").strip() or None,
        scenarioConfig=json.dumps(body.scenarioConfig),
        isActive=True,
    )
    db.add(tr)
    await db.commit()
    await db.refresh(tr)
    # Build response directly — avoids lazy-loading createdBy in async context
    return {
        "id": tr.id,
        "name": tr.name,
        "description": tr.description,
        "scenarioConfig": json.loads(tr.scenarioConfig),
        "isActive": tr.isActive,
        "createdById": tr.createdById,
        "createdBy": {
            "id": current_user.id,
            "firstName": current_user.firstName,
            "lastName": current_user.lastName,
        },
        "createdAt": tr.createdAt,
        "updatedAt": tr.updatedAt,
    }


@router.patch("/{roleplay_id}")
async def update_team_roleplay(
    roleplay_id: str,
    body: UpdateTeamRoleplayRequest,
    current_user: CurrentUser,
    db: DB,
):
    """Update name, description, scenario config, or active state.
    Only the creator or a COMPANY_ADMIN/SUPER_ADMIN may update."""
    result = await db.execute(
        select(TeamRoleplay).where(
            TeamRoleplay.id == roleplay_id,
            TeamRoleplay.companyId == current_user.companyId,
        )
    )
    tr = result.scalar_one_or_none()
    if not tr:
        raise HTTPException(404, "Team roleplay not found")

    can_edit = (
        tr.createdById == current_user.id
        or current_user.role in {UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN}
    )
    if not can_edit:
        raise HTTPException(403, "You can only edit roleplays you created")

    if body.name is not None:
        tr.name = body.name.strip() or tr.name
    if body.description is not None:
        tr.description = body.description.strip() or None
    if body.scenarioConfig is not None:
        tr.scenarioConfig = json.dumps(body.scenarioConfig)
    if body.isActive is not None:
        tr.isActive = body.isActive
    tr.updatedAt = datetime.now(timezone.utc)

    await db.commit()
    # Reload with createdBy eagerly to avoid MissingGreenlet in async context
    result2 = await db.execute(
        select(TeamRoleplay)
        .options(selectinload(TeamRoleplay.createdBy))
        .where(TeamRoleplay.id == tr.id)
    )
    tr = result2.scalar_one()
    return _build_response(tr)


@router.delete("/{roleplay_id}", status_code=204)
async def delete_team_roleplay(
    roleplay_id: str,
    current_user: CurrentUser,
    db: DB,
):
    """Soft-delete (sets isActive=False). Only creator or COMPANY_ADMIN/SUPER_ADMIN."""
    result = await db.execute(
        select(TeamRoleplay).where(
            TeamRoleplay.id == roleplay_id,
            TeamRoleplay.companyId == current_user.companyId,
        )
    )
    tr = result.scalar_one_or_none()
    if not tr:
        raise HTTPException(404, "Team roleplay not found")

    can_delete = (
        tr.createdById == current_user.id
        or current_user.role in {UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN}
    )
    if not can_delete:
        raise HTTPException(403, "You can only delete roleplays you created")

    tr.isActive = False
    tr.updatedAt = datetime.now(timezone.utc)
    await db.commit()
