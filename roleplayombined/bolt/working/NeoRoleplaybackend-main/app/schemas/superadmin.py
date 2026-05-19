from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from app.models.enums import UserRole, Framework


class SetupRequest(BaseModel):
    email: EmailStr
    password: str
    firstName: str
    lastName: str
    setupKey: str


class CompanyAdminInfo(BaseModel):
    id: str
    email: str
    firstName: str
    lastName: str
    isActive: bool = True
    lastLoginAt: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CompanyListItem(BaseModel):
    id: str
    name: str
    slug: str
    isActive: bool = True
    industry: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    registrationInfo: Optional[str] = None
    maxAgents: int
    passThreshold: int
    defaultFramework: Optional[Framework] = None
    createdAt: datetime
    agentCount: int = 0
    adminCount: int = 0
    totalSessions: int = 0
    admins: List[CompanyAdminInfo] = []

    model_config = {"from_attributes": True}


class CreateCompanyRequest(BaseModel):
    companyName: str
    industry: Optional[str] = None
    contactEmail: Optional[EmailStr] = None
    contactPhone: Optional[str] = None
    registrationInfo: Optional[str] = None
    maxAgents: int = 10
    defaultFramework: Framework = Framework.MEDDIC
    adminEmail: EmailStr
    adminFirstName: str
    adminLastName: str


class UpdateCompanyRequest(BaseModel):
    name: Optional[str] = None
    isActive: Optional[bool] = None
    industry: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    registrationInfo: Optional[str] = None
    maxAgents: Optional[int] = None
    passThreshold: Optional[int] = None
    defaultFramework: Optional[Framework] = None


class CreateCompanyResponse(BaseModel):
    companyId: str
    companyName: str
    adminEmail: str
    tempPassword: str


class PlatformStats(BaseModel):
    totalCompanies: int
    activeCompanies: int
    totalUsers: int
    totalSessions: int
    activeUsersThisMonth: int
