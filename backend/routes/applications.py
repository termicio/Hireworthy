from fastapi import APIRouter, HTTPException
from models import ApplicationCreate, ApplicationUpdate, ApplicationOut
from database import get_pool

router = APIRouter()


def _row_to_out(row) -> ApplicationOut:
    return ApplicationOut(
        id=str(row["id"]),
        user_id=row["user_id"],
        company=row["company"],
        role=row["role"],
        status=row["status"],
        match_score=row["match_score"],
        notes=row["notes"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/", response_model=list[ApplicationOut])
async def list_applications():
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM applications ORDER BY created_at DESC")
    return [_row_to_out(r) for r in rows]


@router.post("/", response_model=ApplicationOut, status_code=201)
async def create_application(body: ApplicationCreate):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO applications (company, role, match_score, notes)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            body.company,
            body.role,
            body.match_score,
            body.notes,
        )
    return _row_to_out(row)


@router.patch("/{app_id}", response_model=ApplicationOut)
async def update_application(app_id: str, body: ApplicationUpdate):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM applications WHERE id = $1", app_id)
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
            app_id,
        )
    return _row_to_out(row)


@router.delete("/{app_id}", status_code=204)
async def delete_application(app_id: str):
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM applications WHERE id = $1", app_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Application not found.")
