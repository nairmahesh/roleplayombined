import uuid
import secrets
import string
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.deps import DB, CurrentUser, require_roles
from app.models.user import User
from app.models.company import Company
from app.models.session import Session
from app.models.subscription import Subscription
from app.models.enums import UserRole
from app.core.security import hash_password
from app.config import settings
from app.schemas.superadmin import (
    CompanyListItem,
    CompanyAdminInfo,
    CreateCompanyRequest,
    CreateCompanyResponse,
    UpdateCompanyRequest,
    PlatformStats,
    SetupRequest,
)
from app.schemas.user import UserListItem, UpdateUserRequest

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

SYSTEM_COMPANY_SLUG = "pitchiq-platform-system"


def _gen_temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))


async def _get_or_create_system_company(db) -> Company:
    result = await db.execute(select(Company).where(Company.slug == SYSTEM_COMPANY_SLUG))
    company = result.scalar_one_or_none()
    if not company:
        company = Company(
            name="PitchIQ Platform",
            slug=SYSTEM_COMPANY_SLUG,
            maxAgents=0,
            passThreshold=70,
            isActive=True,
        )
        db.add(company)
        await db.flush()
    return company


@router.post("/setup", status_code=201)
async def setup_super_admin(body: SetupRequest, db: DB):
    """
    Bootstrap endpoint — creates the very first SUPER_ADMIN.
    Blocked once any SUPER_ADMIN already exists.
    Requires SETUP_KEY from .env.
    """
    if body.setupKey != settings.setup_key:
        raise HTTPException(403, "Invalid setup key")

    existing_count = await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.SUPER_ADMIN)
    )
    if existing_count.scalar_one() > 0:
        raise HTTPException(409, "Super admin already exists — use the admin panel to add more")

    email_check = await db.execute(select(User.id).where(User.email == body.email))
    if email_check.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    system_company = await _get_or_create_system_company(db)

    user = User(
        email=body.email,
        passwordHash=hash_password(body.password),
        firstName=body.firstName,
        lastName=body.lastName,
        role=UserRole.SUPER_ADMIN,
        companyId=system_company.id,
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Setup failed — duplicate data")

    return {"message": "Super admin created", "email": user.email}


@router.get("/stats", response_model=PlatformStats,
            dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
async def platform_stats(db: DB):
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)

    tc_q = db.execute(
        select(func.count(Company.id)).where(Company.slug != SYSTEM_COMPANY_SLUG)
    )
    ac_q = db.execute(
        select(func.count(Company.id)).where(
            Company.slug != SYSTEM_COMPANY_SLUG,
            Company.isActive == True,
        )
    )
    tu_q = db.execute(
        select(func.count(User.id)).where(User.role != UserRole.SUPER_ADMIN)
    )
    ts_q = db.execute(select(func.count(Session.id)))
    au_q = db.execute(
        select(func.count(User.id)).where(
            User.lastLoginAt >= month_ago,
            User.role != UserRole.SUPER_ADMIN,
        )
    )

    tc, ac, tu, ts, au = await asyncio.gather(tc_q, ac_q, tu_q, ts_q, au_q)
    return PlatformStats(
        totalCompanies=tc.scalar_one() or 0,
        activeCompanies=ac.scalar_one() or 0,
        totalUsers=tu.scalar_one() or 0,
        totalSessions=ts.scalar_one() or 0,
        activeUsersThisMonth=au.scalar_one() or 0,
    )


@router.get("/companies", response_model=list[CompanyListItem],
            dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
async def list_companies(db: DB):
    result = await db.execute(
        select(Company)
        .where(Company.slug != SYSTEM_COMPANY_SLUG)
        .order_by(Company.createdAt.desc())
    )
    companies = result.scalars().all()
    if not companies:
        return []

    company_ids = [c.id for c in companies]

    uc_result = await db.execute(
        select(User.companyId, User.role, func.count(User.id).label("cnt"))
        .where(User.companyId.in_(company_ids))
        .group_by(User.companyId, User.role)
    )
    user_counts: dict[str, dict] = {}
    for row in uc_result:
        bucket = user_counts.setdefault(row.companyId, {"agents": 0, "admins": 0})
        if row.role == UserRole.AGENT:
            bucket["agents"] += row.cnt
        elif row.role in (UserRole.COMPANY_ADMIN, UserRole.MANAGER):
            bucket["admins"] += row.cnt

    sc_result = await db.execute(
        select(Session.companyId, func.count(Session.id).label("cnt"))
        .where(Session.companyId.in_(company_ids))
        .group_by(Session.companyId)
    )
    session_counts = {row.companyId: row.cnt for row in sc_result}

    admins_result = await db.execute(
        select(User).where(
            User.companyId.in_(company_ids),
            User.role == UserRole.COMPANY_ADMIN,
        )
    )
    admins_by_company: dict[str, list] = {}
    for a in admins_result.scalars():
        admins_by_company.setdefault(a.companyId, []).append(
            CompanyAdminInfo(
                id=a.id,
                email=a.email,
                firstName=a.firstName,
                lastName=a.lastName,
                isActive=a.isActive,
                lastLoginAt=a.lastLoginAt,
            )
        )

    return [
        CompanyListItem(
            id=c.id,
            name=c.name,
            slug=c.slug,
            isActive=c.isActive,
            industry=c.industry,
            contactEmail=c.contactEmail,
            contactPhone=c.contactPhone,
            registrationInfo=c.registrationInfo,
            maxAgents=c.maxAgents,
            passThreshold=c.passThreshold,
            defaultFramework=c.defaultFramework,
            createdAt=c.createdAt,
            agentCount=user_counts.get(c.id, {}).get("agents", 0),
            adminCount=len(admins_by_company.get(c.id, [])),
            totalSessions=session_counts.get(c.id, 0),
            admins=admins_by_company.get(c.id, []),
        )
        for c in companies
    ]


@router.post("/companies", response_model=CreateCompanyResponse, status_code=201,
             dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
async def create_company(body: CreateCompanyRequest, db: DB):
    existing = await db.execute(select(User.id).where(User.email == body.adminEmail))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Admin email already registered")

    from app.models.enums import Framework
    company_id = str(uuid.uuid4())
    slug = (
        body.companyName.lower().replace(" ", "-").replace("'", "")
        + "-" + str(uuid.uuid4())[:8]
    )
    company = Company(
        id=company_id,
        name=body.companyName,
        slug=slug,
        maxAgents=body.maxAgents,
        isActive=True,
        defaultFramework=body.defaultFramework or Framework.MEDDIC,
        industry=body.industry,
        contactEmail=str(body.contactEmail) if body.contactEmail else None,
        contactPhone=body.contactPhone,
        registrationInfo=body.registrationInfo,
    )
    db.add(company)

    sub = Subscription(
        companyId=company_id,
        plan="starter",
        status="active",
        sessionsLimit=50,
        sessionsUsed=0,
        billingEmail=str(body.adminEmail),
        expiresAt=datetime.now(timezone.utc) + timedelta(days=365),
    )
    db.add(sub)

    temp_password = _gen_temp_password()
    admin = User(
        email=str(body.adminEmail),
        passwordHash=hash_password(temp_password),
        firstName=body.adminFirstName,
        lastName=body.adminLastName,
        role=UserRole.COMPANY_ADMIN,
        companyId=company_id,
    )
    db.add(admin)

    try:
        await db.commit()
        await db.refresh(company)
        await db.refresh(admin)
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(409, "Company creation failed — duplicate data")

    return CreateCompanyResponse(
        companyId=company.id,
        companyName=company.name,
        adminEmail=admin.email,
        tempPassword=temp_password,
    )


@router.get("/companies/{company_id}", response_model=CompanyListItem,
            dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
async def get_company(company_id: str, db: DB):
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.slug != SYSTEM_COMPANY_SLUG)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(404, "Company not found")

    uc_result = await db.execute(
        select(User.role, func.count(User.id).label("cnt"))
        .where(User.companyId == company_id)
        .group_by(User.role)
    )
    agent_count = 0
    admin_count = 0
    for row in uc_result:
        if row.role == UserRole.AGENT:
            agent_count = row.cnt
        elif row.role in (UserRole.COMPANY_ADMIN, UserRole.MANAGER):
            admin_count += row.cnt

    sc_result = await db.execute(
        select(func.count(Session.id)).where(Session.companyId == company_id)
    )
    total_sessions = sc_result.scalar_one() or 0

    admins_result = await db.execute(
        select(User).where(User.companyId == company_id, User.role == UserRole.COMPANY_ADMIN)
    )
    admins = [
        CompanyAdminInfo(
            id=a.id, email=a.email,
            firstName=a.firstName, lastName=a.lastName,
            isActive=a.isActive, lastLoginAt=a.lastLoginAt,
        )
        for a in admins_result.scalars()
    ]

    return CompanyListItem(
        id=company.id, name=company.name, slug=company.slug,
        isActive=company.isActive, industry=company.industry,
        contactEmail=company.contactEmail, contactPhone=company.contactPhone,
        registrationInfo=company.registrationInfo,
        maxAgents=company.maxAgents, passThreshold=company.passThreshold,
        defaultFramework=company.defaultFramework, createdAt=company.createdAt,
        agentCount=agent_count, adminCount=admin_count,
        totalSessions=total_sessions, admins=admins,
    )


@router.patch("/companies/{company_id}",
              dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
async def update_company(company_id: str, body: UpdateCompanyRequest, db: DB):
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.slug != SYSTEM_COMPANY_SLUG)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(404, "Company not found")

    if body.name is not None:
        company.name = body.name
    if body.isActive is not None:
        company.isActive = body.isActive
    if body.industry is not None:
        company.industry = body.industry
    if body.contactEmail is not None:
        company.contactEmail = body.contactEmail
    if body.contactPhone is not None:
        company.contactPhone = body.contactPhone
    if body.registrationInfo is not None:
        company.registrationInfo = body.registrationInfo
    if body.maxAgents is not None:
        company.maxAgents = body.maxAgents
    if body.passThreshold is not None:
        company.passThreshold = body.passThreshold
    if body.defaultFramework is not None:
        company.defaultFramework = body.defaultFramework

    await db.commit()
    return {"count": 1}


@router.get("/companies/{company_id}/users", response_model=list[UserListItem],
            dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
async def get_company_users(company_id: str, db: DB):
    result = await db.execute(
        select(User).where(User.companyId == company_id).order_by(User.createdAt.desc())
    )
    users = result.scalars().all()

    user_ids = [u.id for u in users]
    session_stats: dict[str, dict] = {}
    if user_ids:
        sr = await db.execute(
            select(
                Session.userId,
                func.count(Session.id).label("count"),
                func.avg(Session.totalScore).label("avg_score"),
            )
            .where(Session.userId.in_(user_ids))
            .group_by(Session.userId)
        )
        for row in sr:
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


@router.patch("/companies/{company_id}/users/{user_id}",
              dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
async def update_company_user(company_id: str, user_id: str, body: UpdateUserRequest, db: DB):
    result = await db.execute(
        select(User).where(User.id == user_id, User.companyId == company_id)
    )
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
