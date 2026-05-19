import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, Enum as SAEnum, Text
from sqlalchemy.orm import relationship, mapped_column, Mapped
from typing import Optional, List

from app.database import Base
from app.models.enums import Framework


class Company(Base):
    __tablename__ = "Company"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    logoUrl: Mapped[Optional[str]] = mapped_column("logoUrl", String, nullable=True)
    defaultFramework: Mapped[Optional[str]] = mapped_column(
        "defaultFramework", SAEnum(Framework, name="Framework"), nullable=True
    )
    passThreshold: Mapped[int] = mapped_column("passThreshold", Integer, default=70)
    maxAgents: Mapped[int] = mapped_column("maxAgents", Integer, default=10)
    isActive: Mapped[bool] = mapped_column("isActive", Boolean, nullable=False, default=True)
    industry: Mapped[Optional[str]] = mapped_column("industry", String(100), nullable=True)
    contactEmail: Mapped[Optional[str]] = mapped_column("contactEmail", String(255), nullable=True)
    contactPhone: Mapped[Optional[str]] = mapped_column("contactPhone", String(50), nullable=True)
    registrationInfo: Mapped[Optional[str]] = mapped_column("registrationInfo", Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    users: Mapped[List["User"]] = relationship("User", back_populates="company")
    personas: Mapped[List["Persona"]] = relationship("Persona", back_populates="company_rel")
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="company")
    subscription: Mapped[Optional["Subscription"]] = relationship(
        "Subscription", back_populates="company", uselist=False
    )
    teamRoleplays: Mapped[List["TeamRoleplay"]] = relationship(
        "TeamRoleplay", back_populates="company"
    )
