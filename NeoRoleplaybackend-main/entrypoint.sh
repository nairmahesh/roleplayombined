#!/bin/sh
set -e

echo "[PitchIQ] Running database migrations..."
alembic upgrade head

echo "[PitchIQ] Starting server on port ${PORT:-3355}..."
exec uvicorn main:app \
  --host 0.0.0.0 \
  --port "${PORT:-3355}" \
  --workers 1 \
  --log-level "${LOG_LEVEL:-info}"
