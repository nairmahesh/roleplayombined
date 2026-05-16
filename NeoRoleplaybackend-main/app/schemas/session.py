from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

from app.models.enums import SessionType, SessionStatus, Framework, TimelineEventType


class ScenarioConfigInput(BaseModel):
    industry: str
    roleplayType: str
    personaContext: str
    displayName: str = "Custom Persona"
    displayTitle: str = ""
    displayEmoji: str = "🧑‍💼"
    difficulty: str = "Medium"
    suggestedQuestions: list[str] = []
    objections: list[str] = []
    aiCanEnd: bool = True
    endCondition: str = ""
    timeLimitMins: Optional[int] = None
    language: Optional[str] = "English"


class ScenarioConfigResponse(BaseModel):
    industry: str
    roleplayType: str
    personaContext: str
    displayName: str
    displayTitle: str
    displayEmoji: str
    difficulty: str
    suggestedQuestions: list[str] = []
    objections: list[str] = []
    aiCanEnd: bool = True
    endCondition: str = ""
    timeLimitMins: Optional[int] = None
    language: Optional[str] = "English"


class CreateSessionRequest(BaseModel):
    personaId: Optional[str] = None
    scenarioConfig: Optional[ScenarioConfigInput] = None
    type: SessionType
    framework: Framework


class EndSessionRequest(BaseModel):
    transcript: Optional[list[Any]] = None
    durationSeconds: int
    recordingUrl: Optional[str] = None
    skipAnalysis: bool = False


class AddMessageRequest(BaseModel):
    role: str
    content: str
    timestampMs: int
    audioUrl: Optional[str] = None


class AIRespondRequest(BaseModel):
    userMessage: str


class PersonaMinimal(BaseModel):
    id: str
    name: str
    title: str
    emoji: str
    difficulty: str

    model_config = {"from_attributes": True}


class UserMinimal(BaseModel):
    id: str
    firstName: str
    lastName: str
    avatarUrl: Optional[str] = None

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: str
    sessionId: str
    role: str
    content: str
    audioUrl: Optional[str] = None
    timestampMs: int
    createdAt: datetime

    model_config = {"from_attributes": True}


class FrameworkScoreResponse(BaseModel):
    id: str
    component: str
    score: float
    feedback: str
    evidence: list[str] = []

    model_config = {"from_attributes": True}


class TimelineEventResponse(BaseModel):
    id: str
    type: TimelineEventType
    timestampMs: int
    title: str
    description: str
    suggestion: Optional[str] = None
    transcriptRef: Optional[str] = None
    betterResponse: Optional[str] = None

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: str
    type: SessionType
    status: SessionStatus
    framework: Framework
    totalScore: Optional[float] = None
    durationSeconds: Optional[int] = None
    recordingUrl: Optional[str] = None
    startedAt: Optional[datetime] = None
    endedAt: Optional[datetime] = None
    createdAt: datetime
    user: Optional[UserMinimal] = None
    persona: Optional[PersonaMinimal] = None
    scenarioConfig: Optional[ScenarioConfigResponse] = None
    frameworkScores: list[FrameworkScoreResponse] = []
    timelineEvents: list[TimelineEventResponse] = []
    messages: list[MessageResponse] = []

    model_config = {"from_attributes": True}


class PaginationResponse(BaseModel):
    page: int
    limit: int
    total: int
    pages: int


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    pagination: PaginationResponse


class AIRespondResponse(BaseModel):
    response: str
