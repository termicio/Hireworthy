"""Tests for POST /pdf/extract endpoint."""
import io
from unittest.mock import patch, MagicMock

# Text used in happy-path mocks — must survive the >=50 chars validation
# in _extract_text_from_pdf after cleaning.
LONG_TEXT_1 = "Jan Kowalski, Python Developer with three years of FastAPI experience."
LONG_TEXT_2 = "Built PostgreSQL-backed services, Docker deployments and pytest suites."

PDF_HEADER = b"%PDF-1.4\n%mock content for tests"


def _make_page(text: str | None) -> MagicMock:
    """Page mock consistent with the real extraction path:
    - bbox unpacks to 4 numbers,
    - extract_words() spans the full width, so the column detector finds no
      zero-density gap and falls back to plain extract_text().
    """
    page = MagicMock()
    page.bbox = (0, 0, 612, 792)
    if text is None:
        page.extract_words.return_value = []
    else:
        page.extract_words.return_value = [{"x0": 0, "x1": 612}]
    page.extract_text.return_value = text
    return page


def _mock_pdf(pages: list[MagicMock]) -> MagicMock:
    pdf = MagicMock()
    pdf.pages = pages
    pdf.__enter__.return_value = pdf
    pdf.__exit__.return_value = None
    return pdf


async def _ai_passthrough(text: str) -> str:
    return text


def _post_pdf(client, pages_or_side_effect, filename: str = "test.pdf"):
    with patch("routes.pdf.clean_cv_text_ai", side_effect=_ai_passthrough), \
         patch("pdfplumber.open") as mock_open:
        if isinstance(pages_or_side_effect, Exception):
            mock_open.side_effect = pages_or_side_effect
        else:
            mock_open.return_value = _mock_pdf(pages_or_side_effect)
        return client.post(
            "/pdf/extract",
            files={"file": (filename, io.BytesIO(PDF_HEADER), "application/pdf")},
        )


def test_pdf_extract_valid_pdf(client):
    """Extracting text from a valid single-page PDF returns 200 with the text."""
    response = _post_pdf(client, [_make_page(LONG_TEXT_1)])
    assert response.status_code == 200
    assert LONG_TEXT_1 in response.json()["text"]


def test_pdf_extract_non_pdf_file(client):
    """Non-PDF files (e.g., plain text) are rejected."""
    response = client.post(
        "/pdf/extract",
        files={"file": ("test.txt", io.BytesIO(b"just text"), "text/plain")},
    )
    assert response.status_code == 400
    assert "must be a PDF" in response.json()["detail"]


def test_pdf_extract_fake_extension(client):
    """Files with .pdf extension but non-PDF magic bytes are rejected."""
    response = client.post(
        "/pdf/extract",
        files={"file": ("fake.pdf", io.BytesIO(b"not a pdf"), "application/pdf")},
    )
    assert response.status_code == 400
    assert "must be a PDF" in response.json()["detail"]


def test_pdf_extract_file_too_large(client):
    """Files larger than 5MB are rejected."""
    large_content = b"%PDF" + b"x" * (5 * 1024 * 1024)
    response = client.post(
        "/pdf/extract",
        files={"file": ("large.pdf", io.BytesIO(large_content), "application/pdf")},
    )
    assert response.status_code == 400
    assert "too large" in response.json()["detail"]


def test_pdf_extract_no_text_layer(client):
    """PDFs with no extractable text (scans) are rejected with a helpful hint."""
    response = _post_pdf(client, [_make_page(None)], filename="scan.pdf")
    assert response.status_code == 400
    assert "No text could be extracted" in response.json()["detail"]


def test_pdf_extract_multiple_pages(client):
    """Multi-page PDFs concatenate text from all pages."""
    response = _post_pdf(
        client,
        [_make_page(LONG_TEXT_1), _make_page(LONG_TEXT_2)],
        filename="multipage.pdf",
    )
    assert response.status_code == 200
    body = response.json()["text"]
    assert LONG_TEXT_1 in body
    assert LONG_TEXT_2 in body


def test_pdf_extract_corrupted_pdf(client):
    """Corrupted PDFs surface as a 400 with the read-failure message."""
    response = _post_pdf(
        client, Exception("PDF parsing failed"), filename="corrupted.pdf"
    )
    assert response.status_code == 400
    assert "Could not read PDF" in response.json()["detail"]


def test_pdf_extract_whitespace_only_pdf(client):
    """PDFs whose text is only whitespace fail the minimum-length check."""
    response = _post_pdf(
        client, [_make_page("   \n\n  \t  ")], filename="whitespace.pdf"
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "too short" in detail or "No text could be extracted" in detail


def test_pdf_extract_empty_pages(client):
    """Pages without text are skipped; pages with text still come through."""
    response = _post_pdf(
        client,
        [_make_page(None), _make_page(LONG_TEXT_2)],
        filename="mixed.pdf",
    )
    assert response.status_code == 200
    assert LONG_TEXT_2 in response.json()["text"]
