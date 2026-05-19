from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.deps import CurrentUser
from app.services.ai.scenario_generator import generate_scenario, generate_questions

router = APIRouter(prefix="/practice", tags=["practice"])


class GenerateScenarioRequest(BaseModel):
    keywords: str
    industry: str
    roleplayType: str


class GenerateScenarioResponse(BaseModel):
    personaContext: str
    displayName: str
    displayTitle: str
    displayEmoji: str
    difficulty: str
    suggestedQuestions: list[str]


class GenerateQuestionsRequest(BaseModel):
    personaContext: str
    roleplayType: str


class GenerateQuestionsResponse(BaseModel):
    questions: list[str]


@router.post("/generate-scenario", response_model=GenerateScenarioResponse)
async def generate_scenario_endpoint(
    body: GenerateScenarioRequest,
    current_user: CurrentUser,
):
    try:
        result = await generate_scenario(
            keywords=body.keywords,
            industry=body.industry,
            roleplay_type=body.roleplayType,
        )
        return GenerateScenarioResponse(**result)
    except Exception as e:
        raise HTTPException(500, f"Scenario generation failed: {str(e)}")


@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions_endpoint(
    body: GenerateQuestionsRequest,
    current_user: CurrentUser,
):
    try:
        questions = await generate_questions(
            persona_context=body.personaContext,
            roleplay_type=body.roleplayType,
        )
        return GenerateQuestionsResponse(questions=questions)
    except Exception as e:
        raise HTTPException(500, f"Question generation failed: {str(e)}")
