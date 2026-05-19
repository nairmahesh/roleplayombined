import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship, mapped_column, Mapped

from app.database import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    passwordHash: Mapped[str] = mapped_column("passwordHash", String, nullable=False)
    firstName: Mapped[str] = mapped_column("firstName", String, nullable=False)
    lastName: Mapped[str] = mapped_column("lastName", String, nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="UserRole"), nullable=False)
    avatarUrl: Mapped[Optional[str]] = mapped_column("avatarUrl", String, nullable=True)
    isActive: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    lastLoginAt: Mapped[Optional[datetime]] = mapped_column(
        "lastLoginAt", DateTime(timezone=True), nullable=True
    )
    companyId: Mapped[str] = mapped_column(
        "companyId", String, ForeignKey("Company.id"), nullable=False
    )
    managerId: Mapped[Optional[str]] = mapped_column(
        "managerId", String, ForeignKey("User.id"), nullable=True
    )
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    company: Mapped["Company"] = relationship("Company", back_populates="users")
    manager: Mapped[Optional["User"]] = relationship(
        "User", remote_side="User.id", back_populates="reports", foreign_keys=[managerId]
    )
    reports: Mapped[List["User"]] = relationship(
        "User", back_populates="manager", foreign_keys="User.managerId"
    )
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="user")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    __tablename__ = "RefreshToken"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    userId: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False
    )
    expiresAt: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
