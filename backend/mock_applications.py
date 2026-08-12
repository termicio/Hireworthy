"""In-memory stand-in for routes/applications.py — same contract, no Postgres.

Only the database layer is mocked here. Reanalysis still calls the real
ai.py functions (real Claude API calls, real cost) so behaviour matches
the production backend everywhere except persistence.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ai import analyse_cv, clean_cv_text_ai
from models import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    AnalysisOut,
    ReanalyseRequest,
)

router = APIRouter()

MAX_CV_LENGTH = 30_000

_applications: dict[str, dict] = {}
_analyses: dict[str, list[dict]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_app_id(app_id: str) -> str:
    try:
        return str(uuid.UUID(app_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Application not found.")


@router.get("/", response_model=list[ApplicationOut])
async def list_applications():
    rows = sorted(_applications.values(), key=lambda r: r["created_at"], reverse=True)
    return [ApplicationOut(**r) for r in rows]


@router.get("/{app_id}", response_model=ApplicationOut)
async def get_application(app_id: str):
    app_uuid = _parse_app_id(app_id)
    row = _applications.get(app_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return ApplicationOut(**row)


@router.post("/", response_model=ApplicationOut, status_code=201)
async def create_application(body: ApplicationCreate):
    app_id = str(uuid.uuid4())
    now = _now()
    row = {
        "id": app_id,
        "user_id": "placeholder",
        "company": body.company,
        "role": body.role,
        "status": "applied",
        "match_score": body.match_score,
        "job_description": body.job_description,
        "notes": body.notes,
        "created_at": now,
        "updated_at": now,
    }
    _applications[app_id] = row
    if body.match_score is not None:
        categories = [c.model_dump() for c in (body.categories or [])]
        _analyses.setdefault(app_id, []).append({
            "id": str(uuid.uuid4()),
            "application_id": app_id,
            "overall_score": body.match_score,
            "missing_keywords": body.missing_keywords or [],
            "categories": categories,
            "created_at": now,
        })
    return ApplicationOut(**row)


@router.patch("/{app_id}", response_model=ApplicationOut)
async def update_application(app_id: str, body: ApplicationUpdate):
    app_uuid = _parse_app_id(app_id)
    row = _applications.get(app_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    if body.status is not None:
        row["status"] = body.status.value
    if body.notes is not None:
        row["notes"] = body.notes
    row["updated_at"] = _now()
    return ApplicationOut(**row)


@router.delete("/{app_id}", status_code=204)
async def delete_application(app_id: str):
    app_uuid = _parse_app_id(app_id)
    if app_uuid not in _applications:
        raise HTTPException(status_code=404, detail="Application not found.")
    del _applications[app_uuid]
    _analyses.pop(app_uuid, None)


@router.get("/{app_id}/analyses", response_model=list[AnalysisOut])
async def list_analyses(app_id: str):
    app_uuid = _parse_app_id(app_id)
    if app_uuid not in _applications:
        raise HTTPException(status_code=404, detail="Application not found.")
    rows = sorted(_analyses.get(app_uuid, []), key=lambda r: r["created_at"])
    return [AnalysisOut(**r) for r in rows]


@router.post("/{app_id}/analyses", response_model=AnalysisOut, status_code=201)
async def reanalyse_application(app_id: str, body: ReanalyseRequest):
    app_uuid = _parse_app_id(app_id)
    if len(body.cv.strip()) < 50:
        raise HTTPException(status_code=400, detail="CV is too short.")
    if len(body.cv) > MAX_CV_LENGTH:
        raise HTTPException(status_code=400, detail="CV is too long (max 30000 characters).")

    row = _applications.get(app_uuid)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    job_description = body.job_description or row["job_description"]
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

    now = _now()
    categories = [c.model_dump() for c in result.categories]
    analysis_row = {
        "id": str(uuid.uuid4()),
        "application_id": app_uuid,
        "overall_score": result.overall_score,
        "missing_keywords": result.missing_keywords,
        "categories": categories,
        "created_at": now,
    }
    _analyses.setdefault(app_uuid, []).append(analysis_row)
    row["match_score"] = result.overall_score
    row["updated_at"] = now
    return AnalysisOut(**analysis_row)
