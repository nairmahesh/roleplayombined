from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Server
    app_env: str = "development"
    port: int = 4000
    frontend_url: str = "http://localhost:5173"

    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/pitchiq"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_refresh_secret: str = "change-me-refresh-in-production"

    # AI
    openai_api_key: str = ""

    # Voice
    elevenlabs_api_key: str = ""


    # Storage
    aws_region: str = "us-east-1"
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    s3_bucket_name: str = "pitchiq-recordings"

    # Email
    resend_api_key: Optional[str] = None

    # Super Admin Bootstrap
    setup_key: str = "change-this-setup-key"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()
