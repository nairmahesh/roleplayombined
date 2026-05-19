import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.deps import DB
from app.models.user import User, RefreshToken
from app.models.company import Company
from app.models.subscription import Subscription
from app.models.enums import UserRole
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    refresh_token_expires_at,
)
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    LogoutRequest,
    AuthResponse,
    LoginResponse,
    RefreshResponse,
    MeResponse,
    UserResponse,
    CompanyResponse,
)
from app.deps import get_current_user, bearer_scheme
from typing import Annotated
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials

router = APIRouter(prefix="/auth", tags=["auth"])


def _make_slug(name: str) -> str:
    return name.lower().replace(" ", "-").replace("'", "")


def _build_tokens(user: User) -> tuple[str, str]:
    payload = {
        "userId": str(user.id),
        "role": user.role.value,
        "companyId": str(user.companyId),
    }
    return create_access_token(payload), create_refresh_token(payload)


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, db: DB):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    company_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    company = Company(
        id=company_id,
        name=body.companyName,
        slug=_make_slug(body.companyName) + "-" + str(uuid.uuid4())[:8],
        defaultFramework="MEDDIC",
    )
    db.add(company)

    subscription = Subscription(
        companyId=company_id,
        plan="starter",
        status="active",
        sessionsLimit=50,
        sessionsUsed=0,
        billingEmail=body.email,
        expiresAt=datetime.now(timezone.utc) + timedelta(days=365),
    )
    db.add(subscription)

    user = User(
        id=user_id,
        email=body.email,
        passwordHash=hash_password(body.password),
        firstName=body.firstName,
        lastName=body.lastName,
        role=UserRole.COMPANY_ADMIN,
        companyId=company_id,
    )
    db.add(user)

    access_token, refresh_token_str = _build_tokens(user)
    db.add(RefreshToken(
        token=refresh_token_str,
        userId=user_id,
        expiresAt=refresh_token_expires_at(),
    ))

    try:
        await db.commit()
        await db.refresh(user)
        await db.refresh(company)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Registration failed — duplicate data")

    return AuthResponse(
        accessToken=access_token,
        refreshToken=refresh_token_str,
        user=UserResponse(
            id=user.id,
            email=user.email,
            firstName=user.firstName,
            lastName=user.lastName,
            role=user.role,
            avatarUrl=user.avatarUrl,
            createdAt=user.createdAt.isoformat(),
            company=CompanyResponse(
                id=company.id,
                name=company.name,
                defaultFramework=company.defaultFramework,
                passThreshold=company.passThreshold,
            ),
        ),
    )


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: DB):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.isActive:
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(body.password, user.passwordHash):
        raise HTTPException(401, "Invalid credentials")

    user.lastLoginAt = datetime.now(timezone.utc)

    result2 = await db.execute(select(Company).where(Company.id == user.companyId))
    company = result2.scalar_one_or_none()

    access_token, refresh_token_str = _build_tokens(user)
    db.add(RefreshToken(
        token=refresh_token_str,
        userId=user.id,
        expiresAt=refresh_token_expires_at(),
    ))
    await db.commit()
    await db.refresh(user)

    return LoginResponse(
        accessToken=access_token,
        refreshToken=refresh_token_str,
        companyName=company.name if company else "",
        user=UserResponse(
            id=user.id,
            email=user.email,
            firstName=user.firstName,
            lastName=user.lastName,
            role=user.role,
            avatarUrl=user.avatarUrl,
            createdAt=user.createdAt.isoformat(),
        ),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(body: RefreshRequest, db: DB):
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == body.refreshToken)
    )
    stored = result.scalar_one_or_none()
    if not stored or stored.expiresAt.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(401, "Invalid or expired refresh token")

    payload = decode_refresh_token(body.refreshToken)
    if not payload:
        raise HTTPException(401, "Invalid refresh token signature")

    user_result = await db.execute(select(User).where(User.id == stored.userId))
    user = user_result.scalar_one_or_none()
    if not user or not user.isActive:
        raise HTTPException(401, "User not found")

    await db.delete(stored)

    new_access, new_refresh = _build_tokens(user)
    db.add(RefreshToken(
        token=new_refresh,
        userId=user.id,
        expiresAt=refresh_token_expires_at(),
    ))
    await db.commit()

    return RefreshResponse(accessToken=new_access, refreshToken=new_refresh)


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: DB,
):
    if body.refreshToken:
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token == body.refreshToken)
        )
        stored = result.scalar_one_or_none()
        if stored:
            await db.delete(stored)
            await db.commit()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=MeResponse)
async def get_me(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: DB,
):
    from app.core.security import decode_access_token
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(401, "Invalid token")

    result = await db.execute(select(User).where(User.id == payload["userId"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")

    result2 = await db.execute(select(Company).where(Company.id == user.companyId))
    company = result2.scalar_one_or_none()

    return MeResponse(
        id=user.id,
        email=user.email,
        firstName=user.firstName,
        lastName=user.lastName,
        role=user.role,
        avatarUrl=user.avatarUrl,
        createdAt=user.createdAt.isoformat(),
        company=CompanyResponse(
            id=company.id,
            name=company.name,
            defaultFramework=company.defaultFramework,
            passThreshold=company.passThreshold,
        ),
    )
