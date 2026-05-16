"""
Seed script — creates platform system company, super admin, and demo accounts.

Usage (from backend_py/):
    python seed.py

Idempotent: safe to re-run, existing records are skipped.
"""
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, ".")

from app.database import engine, Base
from app.models.company import Company
from app.models.user import User
from app.models.subscription import Subscription
from app.models.enums import UserRole, Framework
from app.core.security import hash_password
from app.config import settings


SYSTEM_COMPANY_SLUG = "pitchiq-platform-system"
DEMO_COMPANY_SLUG = "demo-company-seed"

SUPER_ADMIN = {
    "email": "superadmin@demo.com",
    "password": "Demo1234!",
    "firstName": "Super",
    "lastName": "Admin",
    "role": UserRole.SUPER_ADMIN,
}

DEMO_USERS = [
    {
        "email": "admin@demo.com",
        "password": "Demo1234!",
        "firstName": "Alex",
        "lastName": "Admin",
        "role": UserRole.COMPANY_ADMIN,
    },
    {
        "email": "manager@demo.com",
        "password": "Demo1234!",
        "firstName": "Morgan",
        "lastName": "Manager",
        "role": UserRole.MANAGER,
    },
    {
        "email": "agent@demo.com",
        "password": "Demo1234!",
        "firstName": "Jordan",
        "lastName": "Agent",
        "role": UserRole.AGENT,
    },
]


async def _get_or_create_company(
    session: AsyncSession,
    *,
    name: str,
    slug: str,
    billing_email: str,
    max_agents: int = 0,
    framework: Framework | None = None,
) -> Company:
    result = await session.execute(select(Company).where(Company.slug == slug))
    company = result.scalar_one_or_none()
    if company:
        print(f"  [skip] Company '{name}' already exists")
        return company

    company = Company(
        name=name,
        slug=slug,
        maxAgents=max_agents,
        passThreshold=70,
        isActive=True,
        defaultFramework=framework,
    )
    session.add(company)
    await session.flush()

    far_future = datetime.now(timezone.utc) + timedelta(days=365 * 10)
    sub = Subscription(
        companyId=company.id,
        plan="enterprise" if max_agents == 0 else "starter",
        status="active",
        sessionsLimit=9999,
        sessionsUsed=0,
        billingEmail=billing_email,
        expiresAt=far_future,
    )
    session.add(sub)
    await session.flush()

    print(f"  [+] Created company '{name}'")
    return company


async def _get_or_create_user(
    session: AsyncSession,
    *,
    company_id: str,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    role: UserRole,
    manager_id: str | None = None,
) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        print(f"  [skip] User '{email}' already exists")
        return user

    user = User(
        email=email,
        passwordHash=hash_password(password),
        firstName=first_name,
        lastName=last_name,
        role=role,
        companyId=company_id,
        managerId=manager_id,
        isActive=True,
    )
    session.add(user)
    await session.flush()
    print(f"  [+] Created {role.value} '{email}'")
    return user


async def seed():
    async with engine.begin() as conn:
        # Ensure tables exist (safe no-op if already created)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as session:
        async with session.begin():
            print("\n--- System company & Super Admin ---")
            system_co = await _get_or_create_company(
                session,
                name="PitchIQ Platform",
                slug=SYSTEM_COMPANY_SLUG,
                billing_email=SUPER_ADMIN["email"],
                max_agents=0,
                framework=Framework.MEDDIC,
            )

            await _get_or_create_user(
                session,
                company_id=system_co.id,
                email=SUPER_ADMIN["email"],
                password=SUPER_ADMIN["password"],
                first_name=SUPER_ADMIN["firstName"],
                last_name=SUPER_ADMIN["lastName"],
                role=SUPER_ADMIN["role"],
            )

            print("\n--- Demo company & users ---")
            demo_co = await _get_or_create_company(
                session,
                name="Demo Company",
                slug=DEMO_COMPANY_SLUG,
                billing_email="admin@demo.com",
                max_agents=50,
                framework=Framework.MEDDIC,
            )

            # Create admin first
            admin_user = await _get_or_create_user(
                session,
                company_id=demo_co.id,
                **{k: v for k, v in {
                    "email": DEMO_USERS[0]["email"],
                    "password": DEMO_USERS[0]["password"],
                    "first_name": DEMO_USERS[0]["firstName"],
                    "last_name": DEMO_USERS[0]["lastName"],
                    "role": DEMO_USERS[0]["role"],
                }.items()},
            )

            # Create manager (reports to admin)
            manager_user = await _get_or_create_user(
                session,
                company_id=demo_co.id,
                email=DEMO_USERS[1]["email"],
                password=DEMO_USERS[1]["password"],
                first_name=DEMO_USERS[1]["firstName"],
                last_name=DEMO_USERS[1]["lastName"],
                role=DEMO_USERS[1]["role"],
                manager_id=admin_user.id,
            )

            # Create agent (reports to manager)
            await _get_or_create_user(
                session,
                company_id=demo_co.id,
                email=DEMO_USERS[2]["email"],
                password=DEMO_USERS[2]["password"],
                first_name=DEMO_USERS[2]["firstName"],
                last_name=DEMO_USERS[2]["lastName"],
                role=DEMO_USERS[2]["role"],
                manager_id=manager_user.id,
            )

    print("\n--- Seed complete ---")
    print("\nDemo credentials (password: Demo1234! for all)\n")
    print("  Super Admin   : superadmin@demo.com")
    print("  Company Admin : admin@demo.com")
    print("  Manager       : manager@demo.com")
    print("  Agent         : agent@demo.com")
    print()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
