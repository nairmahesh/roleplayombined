import secrets
import string
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func

from app.deps import DB, CurrentUser, require_roles
from app.models.user import User
from app.models.session import Session, FrameworkScore
from app.models.enums import UserRole
from app.core.security import hash_password
from app.schemas.user import (
    InviteUserRequest,
    UpdateUserRequest,
    UserListItem,
    InviteUserResponse,
    UserStatsResponse,
    UserStatsSession,
    FrameworkBreakdownItem,
)

router = APIRouter(prefix="/users", tags=["users"])


def _generate_temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))


@router.get("", response_model=list[UserListItem])
async def list_users(current_user: CurrentUser, db: DB):
    query = select(User).where(User.companyId == current_user.companyId)

    if current_user.role == UserRole.AGENT:
        query = query.where(User.id == current_user.id)
    elif current_user.role == UserRole.MANAGER:
        query = query.where(
            (User.managerId == current_user.id) | (User.id == current_user.id)
        )

    result = await db.execute(query.order_by(User.createdAt.desc()))
    users = result.scalars().all()

    user_ids = [u.id for u in users]
    session_stats: dict[str, dict] = {}
    if user_ids:
        stats_result = await db.execute(
            select(
                Session.userId,
                func.count(Session.id).label("count"),
                func.avg(Session.totalScore).label("avg_score"),
            )
            .where(Session.userId.in_(user_ids))
            .group_by(Session.userId)
        )
        for row in stats_result:
            session_stats[row.userId] = {"count": row.count, "avg_score": row.avg_score}

    return [
        UserListItem(
            id=u.id, email=u.email, firstName=u.firstName, lastName=u.lastName,
            role=u.role, isActive=u.isActive, avatarUrl=u.avatarUrl,
            lastLoginAt=u.lastLoginAt, createdAt=u.createdAt, managerId=u.managerId,
            sessionCount=session_stats.get(u.id, {}).get("count", 0),
            avgScore=float(v) if (v := session_stats.get(u.id, {}).get("avg_score")) else None,
        )
        for u in users
    ]


@router.post("/invite", response_model=InviteUserResponse, status_code=201,
             dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER))])
async def invite_user(body: InviteUserRequest, current_user: CurrentUser, db: DB):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already in use")

    temp_password = _generate_temp_password()
    new_user = User(
        email=body.email,
        passwordHash=hash_password(temp_password),
        firstName=body.firstName,
        lastName=body.lastName,
        role=body.role,
        companyId=current_user.companyId,
        managerId=current_user.id if current_user.role == UserRole.MANAGER else None,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return InviteUserResponse(
        user=UserListItem(
            id=new_user.id, email=new_user.email,
            firstName=new_user.firstName, lastName=new_user.lastName,
            role=new_user.role, isActive=new_user.isActive,
            avatarUrl=new_user.avatarUrl, lastLoginAt=new_user.lastLoginAt,
            createdAt=new_user.createdAt, managerId=new_user.managerId,
            sessionCount=0, avgScore=None,
        ),
        tempPassword=temp_password,
    )


@router.patch("/{user_id}",
              dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))])
async def update_user(user_id: str, body: UpdateUserRequest, current_user: CurrentUser, db: DB):
    query = select(User).where(User.id == user_id)
    if current_user.role != UserRole.SUPER_ADMIN:
        query = query.where(User.companyId == current_user.companyId)

    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    if body.role is not None:
        user.role = body.role
    if body.isActive is not None:
        user.isActive = body.isActive
    if body.managerId is not None:
        user.managerId = body.managerId

    await db.commit()
    return {"count": 1}


@router.post("/{user_id}/reset-password",
             dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))])
async def reset_password(user_id: str, current_user: CurrentUser, db: DB):
    query = select(User).where(User.id == user_id)
    if current_user.role == UserRole.COMPANY_ADMIN:
        query = query.where(User.companyId == current_user.companyId)

    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    # COMPANY_ADMIN can only reset passwords for agents and managers
    if current_user.role == UserRole.COMPANY_ADMIN and user.role not in (
        UserRole.AGENT, UserRole.MANAGER
    ):
        raise HTTPException(403, "Cannot reset password for this role")

    temp_password = _generate_temp_password()
    user.passwordHash = hash_password(temp_password)
    await db.commit()

    return {"tempPassword": temp_password}


@router.get("/{user_id}/stats", response_model=UserStatsResponse)
async def get_user_stats(user_id: str, current_user: CurrentUser, db: DB):
    if current_user.role == UserRole.AGENT and str(current_user.id) != user_id:
        raise HTTPException(403, "Forbidden")

    result = await db.execute(
        select(Session)
        .where(Session.userId == user_id, Session.companyId == current_user.companyId)
        .order_by(Session.createdAt.desc())
    )
    sessions = result.scalars().all()

    sessions_out = [
        UserStatsSession(
            id=s.id, framework=s.framework.value, totalScore=s.totalScore,
            createdAt=s.createdAt, type=s.type.value,
        )
        for s in sessions
    ]

    session_ids = [s.id for s in sessions]
    breakdown_out = []
    if session_ids:
        fb_result = await db.execute(
            select(
                FrameworkScore.component,
                func.avg(FrameworkScore.score).label("avg_score"),
                func.count(FrameworkScore.id).label("count"),
            )
            .where(FrameworkScore.sessionId.in_(session_ids))
            .group_by(FrameworkScore.component)
        )
        for row in fb_result:
            breakdown_out.append(FrameworkBreakdownItem(
                component=row.component,
                avgScore=float(row.avg_score) if row.avg_score else None,
                count=row.count,
            ))

    return UserStatsResponse(sessions=sessions_out, frameworkBreakdown=breakdown_out)
