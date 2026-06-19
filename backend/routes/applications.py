from fastapi import APIRouter, HTTPException
from models import ApplicationCreate, ApplicationUpdate, ApplicationOut, ApplicationStatus
from datetime import datetime
from uuid import uuid4

router = APIRouter()

# In-memory store for initial development — replace with DB calls
_store: dict[str, dict] = {}


def _now():
    return datetime.utcnow()


@router.get("/", response_model=list[ApplicationOut])
def list_applications():
    # TODO: filter by authenticated user_id from Clerk JWT
    return list(_store.values())


@router.post("/", response_model=ApplicationOut, status_code=201)
def create_application(body: ApplicationCreate):
    app_id = str(uuid4())
    record = {
        "id": app_id,
        "user_id": "placeholder",   # replace with Clerk user id
        "company": body.company,
        "role": body.role,
        "status": ApplicationStatus.APPLIED,
        "match_score": body.match_score,
        "notes": body.notes,
        "created_at": _now(),
        "updated_at": _now(),
    }
    _store[app_id] = record
    return record


@router.patch("/{app_id}", response_model=ApplicationOut)
def update_application(app_id: str, body: ApplicationUpdate):
    if app_id not in _store:
        raise HTTPException(status_code=404, detail="Application not found.")
    record = _store[app_id]
    if body.status is not None:
        record["status"] = body.status
    if body.notes is not None:
        record["notes"] = body.notes
    record["updated_at"] = _now()
    return record


@router.delete("/{app_id}", status_code=204)
def delete_application(app_id: str):
    if app_id not in _store:
        raise HTTPException(status_code=404, detail="Application not found.")
    del _store[app_id]
