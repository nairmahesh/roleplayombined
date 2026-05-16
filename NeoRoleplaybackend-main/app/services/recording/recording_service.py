import uuid
import asyncio
from pathlib import Path
from functools import partial
import boto3
from botocore.config import Config

from app.config import settings

_s3_client = None

# Local fallback storage directory (used when S3 is not configured)
LOCAL_RECORDINGS_DIR = Path(__file__).resolve().parents[4] / "recordings"


def is_s3_configured() -> bool:
    key = settings.aws_access_key_id or ""
    secret = settings.aws_secret_access_key or ""
    return (
        bool(key) and bool(secret)
        and key not in ("your-access-key", "YOUR_ACCESS_KEY", "change-me")
        and secret not in ("your-secret-key", "YOUR_SECRET_KEY", "change-me")
    )


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            config=Config(signature_version="s3v4"),
        )
    return _s3_client


def _build_key(session_id: str, mime_type: str) -> str:
    ext = "mp4" if "mp4" in mime_type else "webm"
    return f"recordings/{session_id}/{uuid.uuid4()}.{ext}"


async def upload_recording(file_bytes: bytes, session_id: str, mime_type: str) -> str:
    key = _build_key(session_id, mime_type)

    if is_s3_configured():
        loop = asyncio.get_event_loop()
        s3 = get_s3_client()
        await loop.run_in_executor(
            None,
            partial(
                s3.put_object,
                Bucket=settings.s3_bucket_name,
                Key=key,
                Body=file_bytes,
                ContentType=mime_type,
            ),
        )
    else:
        # Local fallback — save to recordings/ directory next to the project
        local_path = LOCAL_RECORDINGS_DIR / session_id
        local_path.mkdir(parents=True, exist_ok=True)
        ext = "mp4" if "mp4" in mime_type else "webm"
        filename = f"{uuid.uuid4()}.{ext}"
        (local_path / filename).write_bytes(file_bytes)
        key = f"recordings/{session_id}/{filename}"

    return key


async def get_playback_url(s3_key: str, expires_in: int = 3600) -> str:
    if is_s3_configured():
        loop = asyncio.get_event_loop()
        s3 = get_s3_client()
        return await loop.run_in_executor(
            None,
            partial(
                s3.generate_presigned_url,
                "get_object",
                Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
                ExpiresIn=expires_in,
            ),
        )
    else:
        # Local fallback — s3_key is "recordings/{session_id}/{filename}"
        # Strip the "recordings/" prefix to match the /local/{session_id}/{filename} route
        relative = s3_key.removeprefix("recordings/")
        return f"/api/recordings/local/{relative}"


async def get_upload_url(session_id: str, mime_type: str, expires_in: int = 600) -> tuple[str, str]:
    key = _build_key(session_id, mime_type)
    loop = asyncio.get_event_loop()
    s3 = get_s3_client()
    url = await loop.run_in_executor(
        None,
        partial(
            s3.generate_presigned_url,
            "put_object",
            Params={
                "Bucket": settings.s3_bucket_name,
                "Key": key,
                "ContentType": mime_type,
            },
            ExpiresIn=expires_in,
        ),
    )
    return url, key


async def delete_recording(s3_key: str) -> None:
    if is_s3_configured():
        loop = asyncio.get_event_loop()
        s3 = get_s3_client()
        await loop.run_in_executor(
            None,
            partial(
                s3.delete_object,
                Bucket=settings.s3_bucket_name,
                Key=s3_key,
            ),
        )
    else:
        local_path = LOCAL_RECORDINGS_DIR / Path(s3_key).parent.name / Path(s3_key).name
        if local_path.exists():
            local_path.unlink()
