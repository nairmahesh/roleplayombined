import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship, mapped_column, Mapped

from app.database import Base


class TeamRoleplay(Base):
    __tablename__ = "TeamRoleplay"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    companyId: Mapped[str] = mapped_column(
        "companyId", String, ForeignKey("Company.id"), nullable=False
    )
    createdById: Mapped[str] = mapped_column(
        "createdById", String, ForeignKey("User.id"), nullable=False
    )
    name: Mapped[str] = mapped_column("name", String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column("description", Text, nullable=True)
    scenarioConfig: Mapped[str] = mapped_column("scenarioConfig", Text, nullable=False)  # JSON
    isActive: Mapped[bool] = mapped_column("isActive", Boolean, nullable=False, default=True)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    company: Mapped["Company"] = relationship("Company", back_populates="teamRoleplays")
    createdBy: Mapped["User"] = relationship("User", foreign_keys=[createdById])
