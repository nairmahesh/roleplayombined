from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from pathlib import Path

from app.deps import CurrentUser, DB
from app.models.session import Session
from app.services.recording.recording_service import (
    upload_recording,
    get_playback_url,
    get_upload_url,
    is_s3_configured,
    LOCAL_RECORDINGS_DIR,
)

router = APIRouter(prefix="/recordings", tags=["recordings"])

MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB


def _require_s3():
    if not is_s3_configured():
        raise HTTPException(503, "Recording storage is not configured")


class PresignedUploadRequest(BaseModel):
    sessionId: str
    mimeType: str = "video/webm"


@router.post("/presigned-upload")
async def get_presigned_upload_url(body: PresignedUploadRequest, current_user: CurrentUser):
    _require_s3()
    url, key = await get_upload_url(body.sessionId, body.mimeType)
    return {"uploadUrl": url, "key": key}


@router.get("/playback/{session_id}")
async def get_playback(session_id: str, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.userId == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session or not session.recordingUrl:
        raise HTTPException(404, "No recording found for this session")
    url = await get_playback_url(session.recordingUrl)
    return {"url": url}


@router.post("/upload/{session_id}")
async def upload_session_recording(
    session_id: str,
    current_user: CurrentUser,
    file: UploadFile = File(...),
):
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 500MB)")
    mime_type = file.content_type or "audio/webm"
    key = await upload_recording(content, session_id, mime_type)
    return {"key": key, "sessionId": session_id}


@router.get("/local/{session_id}/{filename}")
async def serve_local_recording(session_id: str, filename: str, current_user: CurrentUser):
    """Serve locally-stored recordings when S3 is not configured."""
    file_path = LOCAL_RECORDINGS_DIR / session_id / filename
    if not file_path.exists():
        raise HTTPException(404, "Recording not found")
    ext = file_path.suffix.lstrip(".")
    media_type = "video/webm" if ext == "webm" else f"video/{ext}"
    return FileResponse(str(file_path), media_type=media_type)
