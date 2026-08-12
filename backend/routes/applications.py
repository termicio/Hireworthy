import json
import uuid

import asyncpg
from fastapi import APIRouter, HTTPException

from ai import analyse_cv, clean_cv_text_ai
from database import get_pool
from models import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    AnalysisOut,
    MatchCategory,
    ReanalyseRequest,
)

router = APIRouter()

MAX_CV_LENGTH = 30_000


def _parse_app_id(app_id: str) -> uuid.UUID:
    """Nieprawidłowy UUID w ścieżce ma dawać 404, nie 500 z asyncpg.DataError."""
    try:
        return uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Application not found.")


def _row_to_out(row) -> ApplicationOut:
    return ApplicationOut(
        id=str(row["id"]),
        user_id=row["user_id"],
        company=row["company"],
        role=row["role"],
        status=row["status"],
        match_score=row["match_score"],
        job_description=row["job_description"],
        notes=row["notes"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _analysis_row_to_out(row) -> AnalysisOut:
    missing_keywords = json.loads(row["missing_keywords"]) if isinstance(row["missing_keywords"], str) else row["missing_keywords"]
    categories = json.loads(row["categories"]) if isinstance(row["categories"], str) else row["categories"]
    return AnalysisOut(
        id=str(row["id"]),
        application_id=str(row["application_id"]),
        overall_score=row["overall_score"],
        missing_keywords=missing_keywords,
        categories=[MatchCategory(**c) for c in categories],
        created_at=row["created_at"],
    )


@router.get("/", response_model=list[ApplicationOut])
async def list_applications():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM applications ORDER BY created_at DESC")
    return [_row_to_out(r) for r in rows]


@router.get("/{app_id}", response_model=ApplicationOut)
async def get_application(app_id: str):
    app_uuid = _parse_app_id(app_id)
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM applications WHERE id = $1", app_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return _row_to_out(row)


@router.post("/", response_model=ApplicationOut, status_code=201)
async def create_application(body: ApplicationCreate):
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO applications (company, role, job_description, match_score, notes)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
                """,
                body.company,
                body.role,
                body.job_description,
                body.match_score,
                body.notes,
            )
            # If the caller supplied an analysis result alongside the
            # application (e.g. saving straight from /analyse), persist it
            # as the first row in the analyses history.
            if body.match_score is not None:
                categories = [c.model_dump() for c in (body.categories or [])]
                await conn.execute(
                    """
                    INSERT INTO analyses (application_id, overall_score, missing_keywords, categories)
                    VALUES ($1, $2, $3, $4)
                    """,
                    row["id"],
                    body.match_score,
                    json.dumps(body.missing_keywords or []),
                    json.dumps(categories),
                )
    return _row_to_out(row)


@router.patch("/{app_id}", response_model=ApplicationOut)
async def update_application(app_id: str, body: ApplicationUpdate):
    app_uuid = _parse_app_id(app_id)
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM applications WHERE id = $1", app_uuid)
        if row is None:
            raise HTTPException(status_code=404, detail="Application not found.")

        new_status = body.status.value if body.status is not None else row["status"]
        new_notes = body.notes if body.notes is not None else row["notes"]

        row = await conn.fetchrow(
            """
            UPDATE applications
            SET status = $1, notes = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
            """,
            new_status,
            new_notes,
            app_uuid,
        )
    return _row_to_out(row)


@router.delete("/{app_id}", status_code=204)
async def delete_application(app_id: str):
    app_uuid = _parse_app_id(app_id)
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM applications WHERE id = $1", app_uuid)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Application not found.")


@router.get("/{app_id}/analyses", response_model=list[AnalysisOut])
async def list_analyses(app_id: str):
    app_uuid = _parse_app_id(app_id)
    pool = get_pool()
    async with pool.acquire() as conn:
        app_row = await conn.fetchrow("SELECT id FROM applications WHERE id = $1", app_uuid)
        if app_row is None:
            raise HTTPException(status_code=404, detail="Application not found.")
        rows = await conn.fetch(
            "SELECT * FROM analyses WHERE application_id = $1 ORDER BY created_at ASC",
            app_uuid,
        )
    return [_analysis_row_to_out(r) for r in rows]


@router.post("/{app_id}/analyses", response_model=AnalysisOut, status_code=201)
async def reanalyse_application(app_id: str, body: ReanalyseRequest):
    app_uuid = _parse_app_id(app_id)
    if len(body.cv.strip()) < 50:
        raise HTTPException(status_code=400, detail="CV is too short.")
    if len(body.cv) > MAX_CV_LENGTH:
        raise HTTPException(status_code=400, detail="CV is too long (max 30000 characters).")

    pool = get_pool()

    # Połączenie z puli zwalniamy PRZED wywołaniami AI (sekundy–dziesiątki
    # sekund) — pula ma max 10 połączeń i równoległe re-analizy zagłodziłyby
    # całe API, gdyby każde trzymało connection przez cały czas analizy.
    async with pool.acquire() as conn:
        app_row = await conn.fetchrow("SELECT * FROM applications WHERE id = $1", app_uuid)
    if app_row is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    job_description = body.job_description or app_row["job_description"]
    if not job_description or len(job_description.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Job description is missing or too short for this application.",
        )

    try:
        cleaned_cv = await clean_cv_text_ai(body.cv)
        result = await analyse_cv(cleaned_cv, job_description)
    except Exception:
        raise HTTPException(status_code=500, detail="Analysis failed.")

    categories = [c.model_dump() for c in result.categories]
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                analysis_row = await conn.fetchrow(
                    """
                    INSERT INTO analyses (application_id, overall_score, missing_keywords, categories)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                    """,
                    app_uuid,
                    result.overall_score,
                    json.dumps(result.missing_keywords),
                    json.dumps(categories),
                )
                await conn.execute(
                    "UPDATE applications SET match_score = $1, updated_at = NOW() WHERE id = $2",
                    result.overall_score,
                    app_uuid,
                )
    except asyncpg.ForeignKeyViolationError:
        # Aplikacja usunięta w trakcie analizy — bez połączenia w ręku nie ma
        # locka na wiersz, więc FK może pęknąć dopiero tutaj.
        raise HTTPException(status_code=404, detail="Application not found.")
    return _analysis_row_to_out(analysis_row)
