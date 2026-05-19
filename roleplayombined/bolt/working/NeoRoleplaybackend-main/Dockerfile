FROM python:3.11-slim-bookworm

WORKDIR /app

# System deps — build-essential for compiling C extensions, curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer-cached until requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Run as non-root for security
RUN addgroup --system pitchiq \
    && adduser --system --ingroup pitchiq --no-create-home pitchiq \
    && chown -R pitchiq:pitchiq /app
USER pitchiq

EXPOSE 3355

ENTRYPOINT ["./entrypoint.sh"]
