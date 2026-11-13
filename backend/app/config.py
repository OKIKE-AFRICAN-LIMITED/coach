import os
from pathlib import Path
from dotenv import load_dotenv

# Load root .env (e:\websites\okikes-coach\.env) first, then backend/.env if present
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)


class Settings:
    PROJECT_NAME: str = "OKIKE Core Intelligence Engine (Coach Ziri)"
    VERSION: str = "1.0.0"

    SUPABASE_URL: str = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")
    SUPABASE_PUBLISHABLE_KEY: str = (
        os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY", "")
    )
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    GOOGLE_GENERATIVE_AI_API_KEY: str = os.getenv("GOOGLE_GENERATIVE_AI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    FIRECRAWL_API_KEY: str = os.getenv("FIRECRAWL_API_KEY", "")

    # Shared secret for connecting other OKIKE platforms / webhooks / bots
    OKIKE_PLATFORM_API_KEY: str = os.getenv("OKIKE_PLATFORM_API_KEY", "")
    DEFAULT_OWNER_USER_ID: str = os.getenv("OKIKE_OWNER_USER_ID", "")

    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "*",
        ).split(",")
        if origin.strip()
    ]


settings = Settings()

