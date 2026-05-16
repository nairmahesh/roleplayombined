from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.models.enums import PersonaDifficulty, Framework


class CreatePersonaRequest(BaseModel):
    name: str
    title: str
    systemPrompt: str
    difficulty: PersonaDifficulty
    company: Optional[str] = "Unknown"
    industry: Optional[str] = "General"
    emoji: Optional[str] = "👤"
    personality: Optional[str] = "{}"
    objections: Optional[list[str]] = []
    buyingSignals: Optional[list[str]] = []
    frameworks: Optional[list[Framework]] = []
    voiceId: Optional[str] = None
    avatarUrl: Optional[str] = None


class PersonaResponse(BaseModel):
    id: str
    name: str
    title: str
    company: str
    industry: str
    emoji: str
    difficulty: PersonaDifficulty
    personality: str
    systemPrompt: str
    objections: list[str] = []
    buyingSignals: list[str] = []
    frameworks: list[str] = []
    isPreset: bool
    isActive: bool
    avatarUrl: Optional[str] = None
    voiceId: Optional[str] = None
    createdAt: datetime

    model_config = {"from_attributes": True}
