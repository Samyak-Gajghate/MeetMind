from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    MIGRATION_DATABASE_URL: str | None = None
    DB_CONNECT_TIMEOUT_SEC: int = 15
    DB_DIAGNOSTICS_ENABLED: bool = True
    GEMINI_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_BUCKET_NAME: str
    JWT_SECRET: str
    ALLOWED_ORIGINS: str
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    MAX_UPLOAD_SIZE_MB: int = 5
    GEMINI_MODEL: str = "gemini-1.5-pro"
    GEMINI_MAX_RETRIES: int = 3
    
    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
