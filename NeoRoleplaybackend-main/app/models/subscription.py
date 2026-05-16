import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship, mapped_column, Mapped

from app.database import Base


class Subscription(Base):
    __tablename__ = "Subscription"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    companyId: Mapped[str] = mapped_column(
        "companyId", String, ForeignKey("Company.id"), unique=True, nullable=False
    )
    plan: Mapped[str] = mapped_column(String, nullable=False, default="starter")
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    sessionsLimit: Mapped[int] = mapped_column("sessionsLimit", Integer, default=50)
    sessionsUsed: Mapped[int] = mapped_column("sessionsUsed", Integer, default=0)
    billingEmail: Mapped[Optional[str]] = mapped_column("billingEmail", String, nullable=True)
    stripeId: Mapped[Optional[str]] = mapped_column("stripeId", String, nullable=True)
    expiresAt: Mapped[Optional[datetime]] = mapped_column(
        "expiresAt", DateTime(timezone=True), nullable=True
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

    company: Mapped["Company"] = relationship("Company", back_populates="subscription")
