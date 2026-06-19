import io

from fastapi import APIRouter, File, HTTPException, Response, UploadFile
import pdfplumber

from models import PDFGenerateRequest, PdfExtractResponse
from pdf_templates import build_html

try:
    from weasyprint import HTML as WeasyprintHTML
    _WEASYPRINT_OK = True
except Exception:
    WeasyprintHTML = None  # type: ignore
    _WEASYPRINT_OK = False

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


@router.post("/generate")
async def generate_pdf(req: PDFGenerateRequest) -> Response:
    if not _WEASYPRINT_OK:
        # Windows: weasyprint requires GTK3 runtime.
        # See: https://github.com/tschoonj/GTK-for-Windows-Runtime-Installer
        # Fallback: pdfkit + wkhtmltopdf
        raise HTTPException(
            status_code=503,
            detail="PDF engine unavailable. weasyprint requires GTK3 on Windows."
        )
    if len(req.cv_text) > 100_000:
        raise HTTPException(status_code=400, detail="CV text too long (max 100 000 characters).")
    html = build_html(req.cv_text, req.layout, req.safe_color)
    try:
        pdf_bytes = WeasyprintHTML(string=html).write_pdf()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=hireworthy-cv.pdf"},
    )
