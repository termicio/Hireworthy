from fastapi import APIRouter, HTTPException

import ai
from models import TailorRequest, TailorResponse

router = APIRouter()


@router.post("/", response_model=TailorResponse)
async def tailor(req: TailorRequest) -> TailorResponse:
    try:
        tailored = await ai.tailor_cv(
            req.cv, req.job_description, req.missing_keywords, req.suggestions
        )
    except Exception:
        raise HTTPException(status_code=502, detail="AI tailoring failed")
    return TailorResponse(tailored_cv=tailored)
