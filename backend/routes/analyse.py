from fastapi import APIRouter, HTTPException
from models import AnalyseRequest, AnalyseResponse
from ai import analyse_cv, clean_cv_text_ai

router = APIRouter()


@router.post("/", response_model=AnalyseResponse)
async def analyse(request: AnalyseRequest):
    if len(request.cv.strip()) < 50:
        raise HTTPException(status_code=400, detail="CV is too short.")
    if len(request.job_description.strip()) < 50:
        raise HTTPException(status_code=400, detail="Job description is too short.")

    try:
        cleaned_cv = await clean_cv_text_ai(request.cv)
        result = await analyse_cv(cleaned_cv, request.job_description)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
