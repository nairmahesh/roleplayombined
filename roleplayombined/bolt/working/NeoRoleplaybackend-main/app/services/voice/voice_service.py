import httpx
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from elevenlabs import AsyncElevenLabs

from app.config import settings

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"


async def stream_tts(text: str, voice_id: str):
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.8,
            "use_speaker_boost": True,
        },
    }

    async def audio_generator():
        # optimize_streaming_latency=4 tells ElevenLabs to send first audio chunk ASAP
        url = f"{ELEVENLABS_BASE}/text-to-speech/{voice_id}/stream?optimize_streaming_latency=4"
        async with httpx.AsyncClient(timeout=30) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    raise HTTPException(status_code=resp.status_code, detail="TTS request failed")
                # Smaller chunks = faster first-byte delivery to the browser
                async for chunk in resp.aiter_bytes(chunk_size=1024):
                    yield chunk

    return StreamingResponse(audio_generator(), media_type="audio/mpeg")


async def get_voices() -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{ELEVENLABS_BASE}/voices",
            headers={"xi-api-key": settings.elevenlabs_api_key},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch voices")
        return resp.json()


async def search_shared_voices(accent: str, gender: str, page_size: int = 9) -> list[dict]:
    """Search ElevenLabs voice library by accent keyword, filter by gender."""
    el = AsyncElevenLabs(api_key=settings.elevenlabs_api_key)
    result = await el.voices.search(search=accent, page_size=page_size)
    voices = []
    for v in result.voices:
        labels = v.labels or {}
        v_gender = (labels.get("gender") or "").lower()
        if gender and v_gender and v_gender != gender.lower():
            continue
        voices.append({
            "id": v.voice_id,
            "public_owner_id": v.sharing.public_owner_id if v.sharing else None,
            "name": v.name,
            "gender": v_gender,
            "accent": labels.get("accent", accent),
            "preview_url": v.preview_url,
        })
    return voices


async def add_shared_voice(public_owner_id: str, voice_id: str) -> bool:
    """Add a shared voice to the user's ElevenLabs library so TTS works."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{ELEVENLABS_BASE}/voices/add/{public_owner_id}/{voice_id}",
            headers={"xi-api-key": settings.elevenlabs_api_key},
        )
        return resp.status_code in (200, 201)
