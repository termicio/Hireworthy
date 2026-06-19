"""Tests for POST /pdf/extract endpoint."""
import io
import pytest
from unittest.mock import patch, MagicMock


def test_pdf_extract_valid_pdf(client):
    """Test extracting text from a valid PDF file."""
    # Minimal valid PDF with text layer
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< >>
stream
BT
/F1 12 Tf
100 700 Td
(Hello World) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
0000000320 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
399
%%EOF"""

    with patch("pdfplumber.open") as mock_pdfplumber:
        # Mock the PDF extraction
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Hello World"
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__.return_value = mock_pdf
        mock_pdf.__exit__.return_value = None
        mock_pdfplumber.return_value = mock_pdf

        response = client.post(
            "/pdf/extract",
            files={"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )

    assert response.status_code == 200
    assert response.json() == {"text": "Hello World"}


def test_pdf_extract_non_pdf_file(client):
    """Test that non-PDF files (e.g., plain text) are rejected."""
    txt_content = b"This is just plain text, not a PDF"

    response = client.post(
        "/pdf/extract",
        files={"file": ("test.txt", io.BytesIO(txt_content), "text/plain")}
    )

    assert response.status_code == 400
    assert "must be a PDF" in response.json()["detail"]


def test_pdf_extract_fake_extension(client):
    """Test that files with .pdf extension but non-PDF magic bytes are rejected."""
    # Plain text with .pdf extension
    fake_pdf_content = b"This is not actually a PDF file"

    response = client.post(
        "/pdf/extract",
        files={"file": ("fake.pdf", io.BytesIO(fake_pdf_content), "application/pdf")}
    )

    assert response.status_code == 400
    assert "must be a PDF" in response.json()["detail"]


def test_pdf_extract_file_too_large(client):
    """Test that files larger than 5MB are rejected."""
    # Create a file just over 5MB
    large_content = b"%PDF" + b"x" * (5 * 1024 * 1024)

    response = client.post(
        "/pdf/extract",
        files={"file": ("large.pdf", io.BytesIO(large_content), "application/pdf")}
    )

    assert response.status_code == 400
    assert "too large" in response.json()["detail"]


def test_pdf_extract_no_text_layer(client):
    """Test that PDFs with no extractable text are rejected."""
    # Valid PDF header but no text content
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
200
%%EOF"""

    with patch("pdfplumber.open") as mock_pdfplumber:
        # Mock empty text extraction
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = None  # No text extracted
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__.return_value = mock_pdf
        mock_pdf.__exit__.return_value = None
        mock_pdfplumber.return_value = mock_pdf

        response = client.post(
            "/pdf/extract",
            files={"file": ("notextpdf.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )

    assert response.status_code == 400
    assert "Could not extract text" in response.json()["detail"]


def test_pdf_extract_multiple_pages(client):
    """Test that multi-page PDFs are handled correctly."""
    pdf_content = b"%PDF-1.4" + b"..." # Minimal content

    with patch("pdfplumber.open") as mock_pdfplumber:
        # Mock multi-page PDF
        mock_pdf = MagicMock()
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page 1 content"
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page 2 content"
        mock_pdf.pages = [mock_page1, mock_page2]
        mock_pdf.__enter__.return_value = mock_pdf
        mock_pdf.__exit__.return_value = None
        mock_pdfplumber.return_value = mock_pdf

        response = client.post(
            "/pdf/extract",
            files={"file": ("multipage.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )

    assert response.status_code == 200
    assert "Page 1 content" in response.json()["text"]
    assert "Page 2 content" in response.json()["text"]


def test_pdf_extract_corrupted_pdf(client):
    """Test that corrupted PDFs are handled gracefully."""
    # PDF header but corrupted structure
    pdf_content = b"%PDF-1.4\ninvalid structure corrupted data !!!"

    with patch("pdfplumber.open") as mock_pdfplumber:
        mock_pdfplumber.side_effect = Exception("PDF parsing failed")

        response = client.post(
            "/pdf/extract",
            files={"file": ("corrupted.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )

    assert response.status_code == 400
    assert "Invalid or corrupted PDF" in response.json()["detail"]


def test_pdf_extract_whitespace_only_pdf(client):
    """Test that PDFs containing only whitespace are rejected."""
    pdf_content = b"%PDF-1.4" + b"..."

    with patch("pdfplumber.open") as mock_pdfplumber:
        # Mock PDF with only whitespace text
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "   \n\n  \t  "  # Only whitespace
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__.return_value = mock_pdf
        mock_pdf.__exit__.return_value = None
        mock_pdfplumber.return_value = mock_pdf

        response = client.post(
            "/pdf/extract",
            files={"file": ("whitespace.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )

    assert response.status_code == 400
    assert "Could not extract text" in response.json()["detail"]


def test_pdf_extract_empty_pages(client):
    """Test PDFs where some pages have no text but others do."""
    pdf_content = b"%PDF-1.4" + b"..."

    with patch("pdfplumber.open") as mock_pdfplumber:
        # Mock PDF where page 1 is empty, page 2 has text
        mock_pdf = MagicMock()
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = None
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Some content"
        mock_pdf.pages = [mock_page1, mock_page2]
        mock_pdf.__enter__.return_value = mock_pdf
        mock_pdf.__exit__.return_value = None
        mock_pdfplumber.return_value = mock_pdf

        response = client.post(
            "/pdf/extract",
            files={"file": ("mixed.pdf", io.BytesIO(pdf_content), "application/pdf")}
        )

    assert response.status_code == 200
    assert "Some content" in response.json()["text"]
