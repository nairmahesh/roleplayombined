from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional

from app.models.enums import UserRole, Framework


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    firstName: str
    lastName: str
    companyName: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


class LogoutRequest(BaseModel):
    refreshToken: Optional[str] = None


class CompanyResponse(BaseModel):
    id: str
    name: str
    defaultFramework: Optional[Framework] = None
    passThreshold: int

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: str
    email: str
    firstName: str
    lastName: str
    role: UserRole
    avatarUrl: Optional[str] = None
    createdAt: str
    company: Optional[CompanyResponse] = None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: UserResponse


class LoginResponse(AuthResponse):
    companyName: str


class RefreshResponse(BaseModel):
    accessToken: str
    refreshToken: str


class MeResponse(BaseModel):
    id: str
    email: str
    firstName: str
    lastName: str
    role: UserRole
    avatarUrl: Optional[str] = None
    createdAt: str
    company: CompanyResponse

    model_config = {"from_attributes": True}
