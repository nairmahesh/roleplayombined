from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import CurrentUser
from app.services.voice.voice_service import stream_tts, get_voices, search_shared_voices, add_shared_voice
from app.services.avatar.photo_service import get_all_avatar_photos

router = APIRouter(prefix="/voice", tags=["voice"])


class TTSRequest(BaseModel):
    text: str


@router.post("/tts/{voice_id}")
async def text_to_speech(voice_id: str, body: TTSRequest, current_user: CurrentUser):
    return await stream_tts(body.text, voice_id)


@router.get("/avatar-photos")
def avatar_photos(current_user: CurrentUser):
    return get_all_avatar_photos()


@router.get("/voices")
async def list_voices(current_user: CurrentUser):
    return await get_voices()


@router.get("/library")
async def voice_library(accent: str, gender: str, current_user: CurrentUser):
    return await search_shared_voices(accent, gender)


@router.post("/library/add/{public_owner_id}/{voice_id}")
async def add_library_voice(public_owner_id: str, voice_id: str, current_user: CurrentUser):
    success = await add_shared_voice(public_owner_id, voice_id)
    return {"success": success}
