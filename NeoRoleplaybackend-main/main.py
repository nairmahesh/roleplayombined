import sys
from contextlib import asynccontextmanager
from loguru import logger

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import socketio

from app.config import settings
from app.database import engine
from app.models import *  # register all models with Base


# ─── Logging ──────────────────────────────────────────────────────────────────
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | {message}",
    level="DEBUG" if not settings.is_production else "INFO",
)


# ─── Lifespan (startup / shutdown) ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"PitchIQ API starting on port {settings.port} ({settings.app_env})")
    try:
        async with engine.begin() as conn:
            logger.info("Database connection established")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
    yield
    await engine.dispose()
    logger.info("PitchIQ API shut down")


# ─── FastAPI App ───────────────────────────────────────────────────────────────
_fastapi_app = FastAPI(
    title="PitchIQ API",
    version="1.0.0",
    description="AI-powered sales coaching platform",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


# ─── CORS ─────────────────────────────────────────────────────────────────────
_fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Rate Limiting ─────────────────────────────────────────────────────────────
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["200/15minutes"])
_fastapi_app.state.limiter = limiter
_fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ─── Exception Handlers ───────────────────────────────────────────────────────
@_fastapi_app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(l) for l in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=400, content={"detail": "Validation error", "errors": errors})


@_fastapi_app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error: {exc}")
    message = str(exc) if not settings.is_production else "Internal server error"
    return JSONResponse(status_code=500, content={"detail": message})


# ─── Routers ──────────────────────────────────────────────────────────────────
from app.routers import auth, users, sessions, personas, analytics, voice, recordings, superadmin, practice, team_roleplays

_fastapi_app.include_router(auth.router, prefix="/api")
_fastapi_app.include_router(users.router, prefix="/api")
_fastapi_app.include_router(sessions.router, prefix="/api")
_fastapi_app.include_router(personas.router, prefix="/api")
_fastapi_app.include_router(analytics.router, prefix="/api")
_fastapi_app.include_router(voice.router, prefix="/api")
_fastapi_app.include_router(recordings.router, prefix="/api")
_fastapi_app.include_router(superadmin.router, prefix="/api")
_fastapi_app.include_router(practice.router, prefix="/api")
_fastapi_app.include_router(team_roleplays.router, prefix="/api")


# ─── Health Check ─────────────────────────────────────────────────────────────
@_fastapi_app.get("/api/health", tags=["health"])
async def health():
    from datetime import datetime, timezone
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ─── Socket.io ────────────────────────────────────────────────────────────────
# app must be the socket wrapper so `uvicorn main:app` serves Socket.IO correctly.
# FastAPI alone does not handle /socket.io/ — the ASGIApp wrapper does.
from app.socket.handlers import sio

app = socketio.ASGIApp(sio, other_asgi_app=_fastapi_app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
