import os

from dotenv import load_dotenv

load_dotenv()


def cors_origins() -> list[str]:
    """Origins allowed to call the API, comma-separated in CORS_ORIGINS.

    Defaults to the local Next.js dev server so a fresh clone works with no
    configuration; a deployed frontend must be added explicitly.
    """
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
