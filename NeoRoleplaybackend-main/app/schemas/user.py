from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from app.models.enums import UserRole


class InviteUserRequest(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    role: UserRole


class UpdateUserRequest(BaseModel):
    role: Optional[UserRole] = None
    isActive: Optional[bool] = None
    managerId: Optional[str] = None


class SessionCountResponse(BaseModel):
    sessions: int

    model_config = {"from_attributes": True}


class UserListItem(BaseModel):
    id: str
    email: str
    firstName: str
    lastName: str
    role: UserRole
    isActive: bool
    avatarUrl: Optional[str] = None
    lastLoginAt: Optional[datetime] = None
    createdAt: datetime
    managerId: Optional[str] = None
    sessionCount: int = 0
    avgScore: Optional[float] = None

    model_config = {"from_attributes": True}


class InviteUserResponse(BaseModel):
    user: UserListItem
    tempPassword: str


class UserStatsSession(BaseModel):
    id: str
    framework: str
    totalScore: Optional[float] = None
    createdAt: datetime
    type: str

    model_config = {"from_attributes": True}


class FrameworkBreakdownItem(BaseModel):
    component: str
    avgScore: Optional[float] = None
    count: int

    model_config = {"from_attributes": True}


class UserStatsResponse(BaseModel):
    sessions: list[UserStatsSession]
    frameworkBreakdown: list[FrameworkBreakdownItem]
