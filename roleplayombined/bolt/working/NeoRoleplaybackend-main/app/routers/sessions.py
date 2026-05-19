import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.deps import DB, CurrentUser
from app.models.session import Session, Message, FrameworkScore, TimelineEvent
from app.models.persona import Persona
from app.models.subscription import Subscription
from app.models.enums import SessionStatus, UserRole
from app.schemas.session import (
    CreateSessionRequest,
    EndSessionRequest,
    AddMessageRequest,
    AIRespondRequest,
    SessionResponse,
    SessionListResponse,
    PaginationResponse,
    MessageResponse,
    AIRespondResponse,
    PersonaMinimal,
    UserMinimal,
    FrameworkScoreResponse,
    TimelineEventResponse,
    ScenarioConfigResponse,
)
from app.services.ai.persona_engine import (
    generate_persona_response,
    generate_scenario_response,
    stream_persona_response,
    stream_scenario_response,
)
from app.services.scoring.session_analyzer import analyze_session
from app.socket.handlers import sio

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _parse_scenario_config(raw: str | None) -> ScenarioConfigResponse | None:
    if not raw:
        return None
    try:
        d = json.loads(raw)
        return ScenarioConfigResponse(
            industry=d.get("industry", ""),
            roleplayType=d.get("roleplayType", ""),
            personaContext=d.get("personaContext", ""),
            displayName=d.get("displayName", "Prospect"),
            displayTitle=d.get("displayTitle", ""),
            displayEmoji=d.get("displayEmoji", "🧑‍💼"),
            difficulty=d.get("difficulty", "Medium"),
            suggestedQuestions=d.get("suggestedQuestions", []),
            objections=d.get("objections", []),
            aiCanEnd=d.get("aiCanEnd", True),
            endCondition=d.get("endCondition", ""),
            timeLimitMins=d.get("timeLimitMins"),
            language=d.get("language", "English"),
        )
    except Exception:
        return None


def _session_to_response(s: Session) -> SessionResponse:
    return SessionResponse(
        id=s.id,
        type=s.type,
        status=s.status,
        framework=s.framework,
        totalScore=s.totalScore,
        durationSeconds=s.durationSeconds,
        recordingUrl=s.recordingUrl,
        startedAt=s.startedAt,
        endedAt=s.endedAt,
        createdAt=s.createdAt,
        user=UserMinimal(
            id=s.user.id,
            firstName=s.user.firstName,
            lastName=s.user.lastName,
            avatarUrl=s.user.avatarUrl,
        ) if s.user else None,
        persona=PersonaMinimal(
            id=s.persona.id,
            name=s.persona.name,
            title=s.persona.title,
            emoji=s.persona.emoji,
            difficulty=s.persona.difficulty.value,
        ) if s.persona else None,
        scenarioConfig=_parse_scenario_config(s.scenarioContext),
        frameworkScores=[
            FrameworkScoreResponse(
                id=fs.id,
                component=fs.component,
                score=fs.score,
                feedback=fs.feedback,
                evidence=fs.evidence or [],
            )
            for fs in (s.frameworkScores or [])
        ],
        timelineEvents=[
            TimelineEventResponse(
                id=te.id,
                type=te.type,
                timestampMs=te.timestampMs,
                title=te.title,
                description=te.description,
                suggestion=te.suggestion,
                transcriptRef=te.transcriptRef,
            )
            for te in (s.timelineEvents or [])
        ],
        messages=[
            MessageResponse(
                id=m.id,
                sessionId=m.sessionId,
                role=m.role,
                content=m.content,
                audioUrl=m.audioUrl,
                timestampMs=m.timestampMs,
                createdAt=m.createdAt,
            )
            for m in sorted(s.messages or [], key=lambda x: x.timestampMs)
        ],
    )


def _load_session_query():
    return (
        select(Session)
        .options(
            selectinload(Session.user),
            selectinload(Session.persona),
            selectinload(Session.frameworkScores),
            selectinload(Session.timelineEvents),
            selectinload(Session.messages),
        )
    )


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    framework: str = Query(None),
    status: str = Query(None),
):
    query = _load_session_query().where(Session.companyId == current_user.companyId)

    if current_user.role == UserRole.AGENT:
        query = query.where(Session.userId == current_user.id)

    if framework:
        query = query.where(Session.framework == framework)
    if status:
        query = query.where(Session.status == status)

    count_result = await db.execute(
        select(func.count()).select_from(
            query.order_by(None).subquery()
        )
    )
    total = count_result.scalar_one()

    query = query.order_by(Session.createdAt.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()

    return SessionListResponse(
        sessions=[_session_to_response(s) for s in sessions],
        pagination=PaginationResponse(
            page=page,
            limit=limit,
            total=total,
            pages=max(1, -(-total // limit)),
        ),
    )


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(body: CreateSessionRequest, current_user: CurrentUser, db: DB):
    if not body.personaId and not body.scenarioConfig:
        raise HTTPException(400, "Either personaId or scenarioConfig is required")

    persona_id = None
    scenario_context_str = None

    if body.personaId:
        p_result = await db.execute(
            select(Persona).where(
                Persona.id == body.personaId,
                Persona.isActive == True,
                (Persona.isPreset == True) | (Persona.companyId == current_user.companyId),
            )
        )
        if not p_result.scalar_one_or_none():
            raise HTTPException(404, "Persona not found or unavailable")
        persona_id = body.personaId
    else:
        scenario_context_str = json.dumps(body.scenarioConfig.model_dump())

    # Check subscription
    sub_result = await db.execute(
        select(Subscription).where(Subscription.companyId == current_user.companyId)
    )
    sub = sub_result.scalar_one_or_none()
    if sub and sub.sessionsUsed >= sub.sessionsLimit:
        raise HTTPException(402, "Session limit reached. Upgrade your plan.")

    session = Session(
        type=body.type,
        status=SessionStatus.PENDING,
        framework=body.framework,
        userId=current_user.id,
        personaId=persona_id,
        scenarioContext=scenario_context_str,
        companyId=current_user.companyId,
    )
    db.add(session)
    await db.commit()

    # Reload with relations
    result = await db.execute(_load_session_query().where(Session.id == session.id))
    session = result.scalar_one()
    return _session_to_response(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, current_user: CurrentUser, db: DB):
    result = await db.execute(
        _load_session_query().where(
            Session.id == session_id,
            Session.companyId == current_user.companyId,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    if current_user.role == UserRole.AGENT and str(session.userId) != str(current_user.id):
        raise HTTPException(403, "Forbidden")

    return _session_to_response(session)


@router.post("/{session_id}/start", response_model=SessionResponse)
async def start_session(session_id: str, current_user: CurrentUser, db: DB):
    result = await db.execute(
        _load_session_query().where(
            Session.id == session_id,
            Session.userId == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status == SessionStatus.IN_PROGRESS:
        result = await db.execute(_load_session_query().where(Session.id == session.id))
        return _session_to_response(result.scalar_one())
    if session.status != SessionStatus.PENDING:
        raise HTTPException(400, f"Cannot start a session with status '{session.status}'")

    session.status = SessionStatus.IN_PROGRESS
    session.startedAt = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)

    result = await db.execute(_load_session_query().where(Session.id == session.id))
    return _session_to_response(result.scalar_one())


@router.post("/{session_id}/end")
async def end_session(
    session_id: str,
    body: EndSessionRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DB,
):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.userId == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    session.status = SessionStatus.COMPLETED
    session.endedAt = datetime.now(timezone.utc)
    session.durationSeconds = body.durationSeconds
    if body.transcript:
        session.transcript = json.dumps(body.transcript)
    if body.recordingUrl:
        session.recordingUrl = body.recordingUrl

    # Increment subscription usage
    sub_result = await db.execute(
        select(Subscription).where(Subscription.companyId == current_user.companyId)
    )
    sub = sub_result.scalar_one_or_none()
    if sub:
        sub.sessionsUsed += 1

    await db.commit()

    # Load messages for analysis
    msg_result = await db.execute(
        select(Message)
        .where(Message.sessionId == session_id)
        .order_by(Message.timestampMs)
    )
    messages = [
        {"role": m.role, "content": m.content, "timestampMs": m.timestampMs}
        for m in msg_result.scalars().all()
    ]

    if not body.skipAnalysis:
        background_tasks.add_task(
            analyze_session,
            session_id,
            messages,
            session.framework.value,
            sio,
        )

    return {"message": "Session ended", "sessionId": session_id}


@router.patch("/{session_id}")
async def patch_session(session_id: str, body: dict, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.userId == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if "recordingUrl" in body:
        session.recordingUrl = body["recordingUrl"]
    await db.commit()
    return {"ok": True}


@router.post("/{session_id}/messages", response_model=MessageResponse, status_code=201)
async def add_message(session_id: str, body: AddMessageRequest, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.companyId == current_user.companyId,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(400, "Session is not in progress")

    if body.role not in ("user", "assistant"):
        raise HTTPException(400, "role must be 'user' or 'assistant'")

    msg = Message(
        sessionId=session_id,
        role=body.role,
        content=body.content,
        timestampMs=body.timestampMs,
        audioUrl=body.audioUrl,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    return MessageResponse(
        id=msg.id,
        sessionId=msg.sessionId,
        role=msg.role,
        content=msg.content,
        audioUrl=msg.audioUrl,
        timestampMs=msg.timestampMs,
        createdAt=msg.createdAt,
    )


@router.post("/{session_id}/respond", response_model=AIRespondResponse)
async def get_ai_response(session_id: str, body: AIRespondRequest, current_user: CurrentUser, db: DB):
    result = await db.execute(
        _load_session_query().where(
            Session.id == session_id,
            Session.companyId == current_user.companyId,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(400, "Session is not in progress")

    history = [
        {"role": m.role, "content": m.content}
        for m in sorted(session.messages, key=lambda x: x.timestampMs)[-30:]
    ]

    if session.scenarioContext:
        scenario = json.loads(session.scenarioContext)
        ai_response = await generate_scenario_response(
            scenario=scenario,
            history=history,
            user_message=body.userMessage,
            framework=session.framework.value,
        )
    else:
        persona_dict = {
            "systemPrompt": session.persona.systemPrompt,
            "name": session.persona.name,
            "objections": session.persona.objections or [],
            "buyingSignals": session.persona.buyingSignals or [],
        }
        ai_response = await generate_persona_response(
            persona=persona_dict,
            history=history,
            user_message=body.userMessage,
            framework=session.framework.value,
        )

    return AIRespondResponse(response=ai_response)


@router.post("/{session_id}/respond/stream")
async def stream_ai_response(session_id: str, body: AIRespondRequest, current_user: CurrentUser, db: DB):
    result = await db.execute(
        _load_session_query().where(
            Session.id == session_id,
            Session.companyId == current_user.companyId,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(400, "Session is not in progress")

    history = [
        {"role": m.role, "content": m.content}
        for m in sorted(session.messages, key=lambda x: x.timestampMs)[-30:]
    ]

    scenario = json.loads(session.scenarioContext) if session.scenarioContext else None
    framework = session.framework.value
    persona_dict = None
    if not scenario and session.persona:
        persona_dict = {
            "systemPrompt": session.persona.systemPrompt,
            "name": session.persona.name,
            "title": session.persona.title or "",
            "difficulty": session.persona.difficulty.value if session.persona.difficulty else "MEDIUM",
            "objections": session.persona.objections or [],
            "buyingSignals": session.persona.buyingSignals or [],
        }

    async def event_generator():
        import time
        from app.database import AsyncSessionLocal
        full_text = ""
        try:
            if scenario:
                gen = stream_scenario_response(scenario, history, body.userMessage, framework)
            else:
                gen = stream_persona_response(persona_dict, history, body.userMessage, framework)

            async for token in gen:
                full_text += token
                yield f"data: {json.dumps({'t': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        timestamp_ms = int(time.time() * 1000)
        async with AsyncSessionLocal() as save_db:
            ai_msg = Message(
                sessionId=session_id,
                role="assistant",
                content=full_text,
                timestampMs=timestamp_ms,
            )
            save_db.add(ai_msg)
            await save_db.commit()

        yield f"data: {json.dumps({'done': True, 'full': full_text})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{session_id}/share")
async def share_session(session_id: str, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.companyId == current_user.companyId,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Session not found")

    # TODO: Send email to manager via Resend/SendGrid
    return {"message": "Session shared successfully"}
