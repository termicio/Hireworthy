import io

from fastapi import APIRouter, File, HTTPException, UploadFile
import pdfplumber

from models import PdfExtractResponse

router = APIRouter()


@router.post("/extract", response_model=PdfExtractResponse)
async def extract_pdf(file: UploadFile = File(...)) -> PdfExtractResponse:
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupted PDF")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    return PdfExtractResponse(text=text.strip())
