import io
import re

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


# Column detection approach:
# Build a horizontal word-density map across the middle 60% of the page (avoiding margins).
# A zero-density gap >= 15pt in that zone indicates a column separator.
# The largest such gap defines the split point. This works for any CV layout
# (single-column, sidebar, equal two-column) without hardcoded coordinates.

def _detect_and_extract_page(page: pdfplumber.page.Page) -> str:
    x0_bbox, top, x1_bbox, bottom = page.bbox
    page_width = x1_bbox - x0_bbox
    words = page.extract_words()

    if not words:
        return ""

    search_start = x0_bbox + page_width * 0.2
    search_end = x0_bbox + page_width * 0.8
    resolution = 2

    word_x_ranges = [(w["x0"], w["x1"]) for w in words]
    x_positions = range(int(search_start), int(search_end), resolution)
    density = {
        x: sum(1 for (wx0, wx1) in word_x_ranges if wx0 <= x <= wx1)
        for x in x_positions
    }

    gaps: list[tuple[int, int, int]] = []
    in_gap = False
    gap_start = 0
    for x in x_positions:
        if density[x] == 0:
            if not in_gap:
                gap_start = x
                in_gap = True
        else:
            if in_gap:
                gaps.append((x - gap_start, gap_start, x))
                in_gap = False
    gaps.sort(reverse=True)

    MIN_COLUMN_GAP = 15

    if gaps and gaps[0][0] >= MIN_COLUMN_GAP:
        gap_len, gap_left, gap_right = gaps[0]
        split_x = (gap_left + gap_right) / 2

        left_text = page.crop((x0_bbox, top, split_x, bottom)).extract_text() or ""
        right_text = page.crop((split_x, top, x1_bbox, bottom)).extract_text() or ""

        if len(right_text.split()) >= len(left_text.split()):
            combined = right_text.strip()
            if left_text.strip():
                combined += "\n\n" + left_text.strip()
        else:
            combined = left_text.strip()
            if right_text.strip():
                combined += "\n\n" + right_text.strip()

        return combined

    return page.extract_text() or ""


def _clean_cv_text(text: str) -> str:
    def fix_spaced_header(match: re.Match) -> str:
        return match.group(0).replace(" ", "")

    text = re.sub(r"\b([A-Z] ){2,}[A-Z]\b", fix_spaced_header, text)
    text = re.sub(
        r"\b([A-Z]{2,})\s([A-Z]{1,2})\s([A-Z]{2,})\b",
        lambda m: m.group(1) + m.group(2) + m.group(3),
        text,
    )
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"^\s*[a-z]\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if not pdf.pages:
                raise ValueError("PDF has no pages.")

            page_texts = [
                _detect_and_extract_page(page)
                for page in pdf.pages
            ]
            page_texts = [t for t in page_texts if t]

            if not page_texts:
                raise ValueError(
                    "No text could be extracted. This may be a scanned/image-based PDF. "
                    "Please copy and paste your CV text instead."
                )

            full_text = _clean_cv_text("\n\n".join(page_texts))

            if len(full_text.strip()) < 50:
                raise ValueError(
                    "Extracted text is too short. "
                    "Please copy and paste your CV text instead."
                )

            return full_text

    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Could not read PDF: {e}. Please paste your CV text instead.")


@router.post("/extract", response_model=PdfExtractResponse)
async def extract_pdf(file: UploadFile = File(...)) -> PdfExtractResponse:
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        text = _extract_text_from_pdf(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PdfExtractResponse(text=text)


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
