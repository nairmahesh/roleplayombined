from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select

from app.deps import DB, CurrentUser, require_roles
from app.models.persona import Persona
from app.models.enums import UserRole
from app.schemas.persona import CreatePersonaRequest, PersonaResponse

router = APIRouter(prefix="/personas", tags=["personas"])


@router.get("", response_model=list[PersonaResponse])
async def list_personas(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Persona)
        .where(
            Persona.isActive == True,
            (Persona.isPreset == True) | (Persona.companyId == current_user.companyId),
        )
        .order_by(Persona.isPreset.desc(), Persona.name)
    )
    personas = result.scalars().all()
    return [
        PersonaResponse(
            id=p.id,
            name=p.name,
            title=p.title,
            company=p.company,
            industry=p.industry,
            emoji=p.emoji,
            difficulty=p.difficulty,
            personality=p.personality,
            systemPrompt=p.systemPrompt,
            objections=p.objections or [],
            buyingSignals=p.buyingSignals or [],
            frameworks=[f if isinstance(f, str) else f.value for f in (p.frameworks or [])],
            isPreset=p.isPreset,
            isActive=p.isActive,
            avatarUrl=p.avatarUrl,
            voiceId=p.voiceId,
            createdAt=p.createdAt,
        )
        for p in personas
    ]


@router.post(
    "",
    response_model=PersonaResponse,
    status_code=201,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER))],
)
async def create_persona(body: CreatePersonaRequest, current_user: CurrentUser, db: DB):
    persona = Persona(
        name=body.name,
        title=body.title,
        company=body.company or "Unknown",
        industry=body.industry or "General",
        emoji=body.emoji or "👤",
        difficulty=body.difficulty,
        personality=body.personality or "{}",
        systemPrompt=body.systemPrompt,
        objections=body.objections or [],
        buyingSignals=body.buyingSignals or [],
        frameworks=body.frameworks or [],
        voiceId=body.voiceId,
        avatarUrl=body.avatarUrl,
        isPreset=False,
        isActive=True,
        companyId=current_user.companyId,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)

    return PersonaResponse(
        id=persona.id,
        name=persona.name,
        title=persona.title,
        company=persona.company,
        industry=persona.industry,
        emoji=persona.emoji,
        difficulty=persona.difficulty,
        personality=persona.personality,
        systemPrompt=persona.systemPrompt,
        objections=persona.objections or [],
        buyingSignals=persona.buyingSignals or [],
        frameworks=[f if isinstance(f, str) else f.value for f in (persona.frameworks or [])],
        isPreset=persona.isPreset,
        isActive=persona.isActive,
        avatarUrl=persona.avatarUrl,
        voiceId=persona.voiceId,
        createdAt=persona.createdAt,
    )


@router.delete(
    "/{persona_id}",
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN))],
)
async def delete_persona(persona_id: str, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Persona).where(
            Persona.id == persona_id,
            Persona.companyId == current_user.companyId,
            Persona.isPreset == False,
        )
    )
    persona = result.scalar_one_or_none()
    if not persona:
        raise HTTPException(404, "Persona not found or cannot be deleted")

    persona.isActive = False
    await db.commit()
    return {"message": "Persona deleted"}
