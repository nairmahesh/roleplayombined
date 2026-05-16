import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship, mapped_column, Mapped

from app.database import Base
from app.models.enums import PersonaDifficulty, Framework


class Persona(Base):
    __tablename__ = "Persona"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    company: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[str] = mapped_column(String, nullable=False)
    emoji: Mapped[str] = mapped_column(String, nullable=False)
    difficulty: Mapped[PersonaDifficulty] = mapped_column(
        SAEnum(PersonaDifficulty, name="PersonaDifficulty"), nullable=False
    )
    personality: Mapped[str] = mapped_column(Text, nullable=False)
    systemPrompt: Mapped[str] = mapped_column("systemPrompt", Text, nullable=False)
    objections: Mapped[List[str]] = mapped_column(ARRAY(String), default=list)
    buyingSignals: Mapped[List[str]] = mapped_column("buyingSignals", ARRAY(String), default=list)
    frameworks: Mapped[List[str]] = mapped_column(
        ARRAY(SAEnum(Framework, name="Framework", create_constraint=False)), default=list
    )
    isPreset: Mapped[bool] = mapped_column("isPreset", Boolean, default=False)
    isActive: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    avatarUrl: Mapped[Optional[str]] = mapped_column("avatarUrl", String, nullable=True)
    voiceId: Mapped[Optional[str]] = mapped_column("voiceId", String, nullable=True)
    companyId: Mapped[Optional[str]] = mapped_column(
        "companyId", String, ForeignKey("Company.id"), nullable=True
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

    company_rel: Mapped[Optional["Company"]] = relationship("Company", back_populates="personas")
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="persona")
