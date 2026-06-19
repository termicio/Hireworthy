from fastapi import APIRouter, HTTPException

import ai
from models import ReviewRequest, ReviewResponse

router = APIRouter()


@router.post("/", response_model=ReviewResponse)
async def review(request: ReviewRequest) -> ReviewResponse:
    cv = request.cv.strip()
    if len(cv) < 50:
        raise HTTPException(status_code=400, detail="CV is too short.")
    if len(cv) > 30_000:
        raise HTTPException(status_code=400, detail="CV is too long (max 30 000 characters).")
    try:
        return await ai.review_cv(cv)
    except Exception:
        raise HTTPException(status_code=500, detail="Review failed. Please try again.")
