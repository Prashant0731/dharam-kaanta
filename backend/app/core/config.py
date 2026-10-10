from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Dharam Kaanta API"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # Database (Supabase/PostgreSQL)
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/dharam_kaanta"
    # Or Supabase: postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
    
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    
    # CORS
    ALLOWED_ORIGINS: list[str] = ["*"]
    
    # File upload
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()