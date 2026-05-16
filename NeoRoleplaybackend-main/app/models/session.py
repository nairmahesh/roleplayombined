import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, Float, DateTime, Enum as SAEnum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship, mapped_column, Mapped

from app.database import Base
from app.models.enums import SessionType, SessionStatus, Framework, TimelineEventType


class Session(Base):
    __tablename__ = "Session"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type: Mapped[SessionType] = mapped_column(SAEnum(SessionType, name="SessionType"), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus, name="SessionStatus"), nullable=False, default=SessionStatus.PENDING
    )
    framework: Mapped[Framework] = mapped_column(SAEnum(Framework, name="Framework"), nullable=False)
    totalScore: Mapped[Optional[float]] = mapped_column("totalScore", Float, nullable=True)
    durationSeconds: Mapped[Optional[int]] = mapped_column("durationSeconds", Integer, nullable=True)
    recordingUrl: Mapped[Optional[str]] = mapped_column("recordingUrl", String, nullable=True)
    transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    aiFeedback: Mapped[Optional[str]] = mapped_column("aiFeedback", Text, nullable=True)
    startedAt: Mapped[Optional[datetime]] = mapped_column(
        "startedAt", DateTime(timezone=True), nullable=True
    )
    endedAt: Mapped[Optional[datetime]] = mapped_column(
        "endedAt", DateTime(timezone=True), nullable=True
    )
    userId: Mapped[str] = mapped_column(
        "userId", String, ForeignKey("User.id"), nullable=False
    )
    personaId: Mapped[Optional[str]] = mapped_column(
        "personaId", String, ForeignKey("Persona.id"), nullable=True
    )
    scenarioContext: Mapped[Optional[str]] = mapped_column("scenarioContext", Text, nullable=True)
    companyId: Mapped[str] = mapped_column(
        "companyId", String, ForeignKey("Company.id"), nullable=False
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

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    persona: Mapped[Optional["Persona"]] = relationship("Persona", back_populates="sessions")
    company: Mapped["Company"] = relationship("Company", back_populates="sessions")
    messages: Mapped[List["Message"]] = relationship(
        "Message", back_populates="session", cascade="all, delete-orphan",
        order_by="Message.timestampMs"
    )
    frameworkScores: Mapped[List["FrameworkScore"]] = relationship(
        "FrameworkScore", back_populates="session", cascade="all, delete-orphan"
    )
    timelineEvents: Mapped[List["TimelineEvent"]] = relationship(
        "TimelineEvent", back_populates="session", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "Message"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sessionId: Mapped[str] = mapped_column(
        "sessionId", String, ForeignKey("Session.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    audioUrl: Mapped[Optional[str]] = mapped_column("audioUrl", String, nullable=True)
    timestampMs: Mapped[int] = mapped_column("timestampMs", Integer, nullable=False, default=0)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session: Mapped["Session"] = relationship("Session", back_populates="messages")


class FrameworkScore(Base):
    __tablename__ = "FrameworkScore"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sessionId: Mapped[str] = mapped_column(
        "sessionId", String, ForeignKey("Session.id", ondelete="CASCADE"), nullable=False
    )
    component: Mapped[str] = mapped_column(String, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[List[str]] = mapped_column(ARRAY(String), default=list)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session: Mapped["Session"] = relationship("Session", back_populates="frameworkScores")


class TimelineEvent(Base):
    __tablename__ = "TimelineEvent"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sessionId: Mapped[str] = mapped_column(
        "sessionId", String, ForeignKey("Session.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[TimelineEventType] = mapped_column(
        SAEnum(TimelineEventType, name="TimelineEventType"), nullable=False
    )
    timestampMs: Mapped[int] = mapped_column("timestampMs", Integer, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    suggestion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transcriptRef: Mapped[Optional[str]] = mapped_column("transcriptRef", Text, nullable=True)
    betterResponse: Mapped[Optional[str]] = mapped_column("betterResponse", Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session: Mapped["Session"] = relationship("Session", back_populates="timelineEvents")
