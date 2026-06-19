import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | None = None


async def create_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(dsn=os.getenv("DATABASE_URL"), min_size=1, max_size=10)
    async with _pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     TEXT NOT NULL DEFAULT 'placeholder',
                company     TEXT NOT NULL,
                role        TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'applied',
                match_score INT,
                notes       TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialised.")
    return _pool
