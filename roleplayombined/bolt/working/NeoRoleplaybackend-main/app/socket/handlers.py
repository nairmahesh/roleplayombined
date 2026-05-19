import socketio
from urllib.parse import parse_qs
from loguru import logger

from app.core.security import decode_access_token

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


@sio.event
async def connect(sid, environ, auth):
    logger.debug(f"Socket connect attempt sid={sid} auth={auth} qs={environ.get('QUERY_STRING', '')}")

    token = (auth or {}).get("token")

    # Try query string (?token=...)
    if not token:
        qs = parse_qs(environ.get("QUERY_STRING", ""))
        token = (qs.get("token") or [None])[0]

    # Try Authorization header
    if not token:
        auth_header = environ.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        logger.warning(f"Socket rejected — no token found. environ keys: {list(environ.keys())} (sid={sid})")
        return False

    payload = decode_access_token(token)
    if not payload:
        logger.warning(f"Socket rejected — token invalid/expired (sid={sid})")
        return False

    await sio.save_session(sid, {
        "userId": payload.get("userId"),
        "role": payload.get("role"),
        "companyId": payload.get("companyId"),
    })
    logger.info(f"Socket connected: userId={payload.get('userId')} sid={sid}")


@sio.event
async def disconnect(sid):
    logger.info(f"Socket disconnected: sid={sid}")


# ─── session:join ──────────────────────────────────────────────────────────────
@sio.on("session:join")
async def on_session_join(sid, data):
    session_id = data.get("sessionId")
    if not session_id:
        return
    room = f"session:{session_id}"
    await sio.enter_room(sid, room)
    logger.debug(f"sid={sid} joined room {room}")


# ─── session:start ─────────────────────────────────────────────────────────────
@sio.on("session:start")
async def on_session_start(sid, data):
    session_id = data.get("sessionId")
    if not session_id:
        return {"success": False, "error": "Missing sessionId"}

    try:
        import json as _json
        from app.database import AsyncSessionLocal
        from app.models.session import Session, Message
        from app.services.ai.persona_engine import generate_persona_opening, generate_scenario_opening
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Session)
                .options(selectinload(Session.persona), selectinload(Session.messages))
                .where(Session.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                return {"success": False, "error": "Session not found"}

            # Idempotency: return existing opening if already generated
            existing = next(
                (m for m in sorted(session.messages or [], key=lambda x: x.timestampMs)
                 if m.role == "assistant"),
                None,
            )
            if existing:
                return {"success": True, "opening": existing.content}

            if session.scenarioContext:
                scenario = _json.loads(session.scenarioContext)
                opening_text = await generate_scenario_opening(scenario, session.type.value)
            elif session.persona:
                persona_dict = {
                    "name": session.persona.name,
                    "title": session.persona.title,
                    "systemPrompt": session.persona.systemPrompt,
                    "objections": session.persona.objections or [],
                    "buyingSignals": session.persona.buyingSignals or [],
                }
                opening_text = await generate_persona_opening(persona_dict, session.type.value)
            else:
                return {"success": False, "error": "Session has no persona or scenario"}

            msg = Message(
                sessionId=session_id,
                role="assistant",
                content=opening_text,
                timestampMs=0,
            )
            db.add(msg)
            await db.commit()

        return {"success": True, "opening": opening_text}

    except Exception as e:
        logger.error(f"session:start error: {e}")
        await sio.emit("session:ai_error", {"error": str(e)}, to=sid)
        return {"success": False, "error": str(e)}


# ─── session:user_message ──────────────────────────────────────────────────────
@sio.on("session:user_message")
async def on_session_user_message(sid, data):
    session_id = data.get("sessionId")
    text = data.get("text", "")
    timestamp_ms = data.get("timestampMs", 0)

    if not session_id or not text:
        return {"success": False, "error": "Missing sessionId or text"}

    try:
        from app.database import AsyncSessionLocal
        from app.models.session import Session, Message
        from app.services.ai.persona_engine import generate_persona_response
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Session)
                .options(
                    selectinload(Session.persona),
                    selectinload(Session.messages),
                )
                .where(Session.id == session_id)
            )
            session = result.scalar_one_or_none()
            if not session:
                return {"success": False, "error": "Session not found"}

            user_msg = Message(
                sessionId=session_id,
                role="user",
                content=text,
                timestampMs=timestamp_ms,
            )
            db.add(user_msg)
            await db.flush()

            room = f"session:{session_id}"
            await sio.emit("session:ai_thinking", {}, room=room)

            history = [
                {"role": m.role, "content": m.content}
                for m in sorted(session.messages, key=lambda x: x.timestampMs)[-30:]
            ]

            if session.scenarioContext:
                import json as _json2
                from app.services.ai.persona_engine import generate_scenario_response
                scenario = _json2.loads(session.scenarioContext)
                ai_text = await generate_scenario_response(
                    scenario=scenario,
                    history=history,
                    user_message=text,
                    framework=session.framework.value,
                )
            else:
                persona_dict = {
                    "systemPrompt": session.persona.systemPrompt,
                    "name": session.persona.name,
                    "title": session.persona.title or "",
                    "difficulty": session.persona.difficulty.value if session.persona.difficulty else "MEDIUM",
                    "objections": session.persona.objections or [],
                    "buyingSignals": session.persona.buyingSignals or [],
                }
                ai_text = await generate_persona_response(
                    persona=persona_dict,
                    history=history,
                    user_message=text,
                    framework=session.framework.value,
                )

            ai_msg = Message(
                sessionId=session_id,
                role="assistant",
                content=ai_text,
                timestampMs=timestamp_ms + 1500,
            )
            db.add(ai_msg)
            await db.commit()
            await db.refresh(ai_msg)

        await sio.emit(
            "session:ai_message",
            {
                "text": ai_text,
                "timestampMs": timestamp_ms + 1500,
                "messageId": str(ai_msg.id),
            },
            room=f"session:{session_id}",
        )
        return {"success": True}

    except Exception as e:
        logger.error(f"session:user_message error: {e}")
        await sio.emit(
            "session:ai_error",
            {"error": str(e)},
            room=f"session:{session_id}",
        )
        return {"success": False, "error": str(e)}


# ─── session:transcript_update ─────────────────────────────────────────────────
@sio.on("session:transcript_update")
async def on_session_transcript_update(sid, data):
    session_id = data.get("sessionId")
    if not session_id:
        return
    await sio.emit(
        "session:transcript_update",
        data,
        room=f"session:{session_id}",
        skip_sid=sid,
    )
