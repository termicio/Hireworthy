## Przegląd (reviewer)

Reviewed files:
- `backend/models.py` (PDFGenerateRequest)
- `backend/pdf_templates.py`
- `backend/routes/pdf.py`
- `frontend/lib/api.ts`
- `frontend/components/CVPreview.tsx`
- `frontend/components/TailorSection.tsx`

---

### Critical

**1. XSS via unsanitised `color` value injected directly into HTML/CSS — both Python and TypeScript**
- `backend/pdf_templates.py` lines 94, 96, 123, 129–130, 150, 167, 171 — `accent` (the user-supplied `color` field) is interpolated raw into inline `style` attributes without escaping or validation. An attacker can close the style attribute and inject arbitrary HTML: `color: red"><script>...` or a CSS `expression()` payload. In WeasyPrint this can trigger JavaScript execution or at minimum inject malformed CSS.
- `frontend/components/CVPreview.tsx` lines 68–69, 85, 101 — same issue; `accent`/`accentCol` is inserted directly into the HTML string rendered inside the iframe.
- The `PDFGenerateRequest` model (`models.py` line 93–96) accepts `color: Optional[str] = None` with no validation of format (hex, CSS keyword, etc.).
- **Severity: Critical** — user-controlled string reaches raw HTML/CSS output in both PDF and live preview.

---

### Important

**2. Parser divergence — bullet stripping regex vs. Python `lstrip`**
- Python (`pdf_templates.py` line 44): `line.lstrip("•-* ").strip()` — `lstrip` strips *any combination* of those characters from the left, so `--text` becomes `text`, and `* * item` strips both stars and spaces.
- TypeScript (`CVPreview.tsx` line 33): `line.replace(/^[•\-*]\s*/, "")` — replaces exactly **one** leading marker character followed by optional whitespace. A line starting with `--` or `* ` followed by another marker would be stripped differently.
- Concrete divergence: Python would produce `"item"` from `"-- item"`, TypeScript would produce `"- item"` from the same input.

**3. Parser divergence — underline detection**
- Python (`pdf_templates.py` line 31): `set(lines[i + 1].replace(" ", "")).issubset({"-", "="})` — accepts lines containing only dashes/equals/spaces, including a line that is *entirely spaces* after replacement (empty set is subset of everything — a blank line would pass `issubset`).
- TypeScript (`CVPreview.tsx` line 25): `nextLine.length > 0 && [...nextLine.replace(/ /g, "")].every(c => c === "-" || c === "=")` — has the `length > 0` guard on the original line before replacement but does not guard against a line that becomes empty after spaces are stripped (e.g., a line of only spaces).
- Python has no guard at all: `set("   ".replace(" ", ""))` = `set("")` = `set()` which `issubset({"-","="})` returns `True`. This means a blank/whitespace-only line after a content line would be misclassified as an underline marker in Python but not in TypeScript.

**4. Split layout — intro section (header=None) routed to right column only**
- Python (`pdf_templates.py` lines 157–160): sections where `s["header"]` is falsy (the intro section before the first heading) do **not** match `"SKILL" in s["header"].upper()` — they go to `right_sections`. This is correct but undocumented, and name/title are hardcoded into `left_html` separately, so the intro body lines (contact info, email, phone) end up in the right column. This may be intentional but is likely a layout bug for CVs that put contact info as body lines before the first section header.
- TypeScript (`CVPreview.tsx` line 104): `sections.filter(s => !s.header?.toUpperCase().includes("SKILL"))` — `null?.includes()` returns `undefined` which is falsy, so `!undefined` = `true`, meaning intro sections (header=null) also go to `rightSections`. Behaviour matches Python on this point, but the underlying concern remains.

**5. `revokeObjectURL` called synchronously immediately after `a.click()`**
- `TailorSection.tsx` lines 63–65: `a.click()` triggers the download asynchronously; `URL.revokeObjectURL(url)` is called on the very next line, before the browser has actually fetched the blob. On some browsers (especially Firefox) this races the download and can result in a failed or zero-byte download.
- The fix is to revoke after a short timeout or on the `load` event, but this is not done.

**6. No input length / size validation on `cv_text` in the backend**
- `backend/routes/pdf.py` line 41 / `models.py` lines 93–96: `cv_text` is accepted as an unbounded string. A large payload would cause WeasyPrint to consume significant memory/CPU rendering a giant HTML document. There is no max-length guard analogous to the 5 MB PDF upload guard.

---

### Minor

**7. `console.error(err)` in `handleDownloadPDF` logs the full Error object including stack trace to production console**
- `TailorSection.tsx` line 68: `console.error(err)` — CLAUDE.md permits `console.error` in catch blocks, so this is technically compliant, but it logs the entire Error object (including potential response detail from the server). `console.error("PDF generation failed:", err instanceof Error ? err.message : err)` would be safer.

**8. Python `_escape` does not escape single quotes or double quotes**
- `pdf_templates.py` line 4–6: `'` and `"` are not escaped. Since escaped text is only ever placed inside element content (not inside HTML attribute values), this is not an XSS vector for the text content itself — but if the pattern is reused in a context where attribute value injection is possible in future, it becomes dangerous. Standard practice is to escape `"` as `&quot;` as well.

**9. `color` field initialised to `"#1B2A4A"` in state but typed as `string | null`**
- `TailorSection.tsx` line 21: `const [selectedColor, setSelectedColor] = useState<string | null>("#1B2A4A")` — the default matches the first swatch. This is fine functionally, but if the swatch list changes order without updating the default, the selected ring highlight will be on the wrong swatch. A minor coupling issue.

**10. `iframe sandbox=""` blocks all — correct, but also blocks CSS `@font-face` and external resources**
- `CVPreview.tsx` line 147: `sandbox=""` with no permissions is appropriate for XSS isolation. However it also blocks `allow-same-origin` which means any relative URL in the generated HTML would fail. Since all styles are inline and no external resources are loaded in the generated HTML, this is not currently a bug — but it is fragile. Worth a comment explaining the intentional trade-off.

**11. Missing `type` keyword on type-only import in `TailorSection.tsx`**
- `TailorSection.tsx` line 5: `import { useState } from "react"; ... import { tailorCV, generatePDF, type PDFLayout } from "@/lib/api";` — `PDFLayout` correctly uses `type`. No violation here. (OK — this is fine.)

**12. `name` / `title` not rendered in split layout right column when CV has no SKILL section**
- If `cv_text` contains no section with "SKILL" in the header, `leftSections` is empty and the left column contains only the name and title div (hardcoded). The right column gets all sections. This is the intended behaviour per the code comments, but it means the split layout degrades silently — the user sees a large grey left panel with only name/title, which may look broken. No warning or fallback.

---

### OK

- `PDFGenerateRequest` model structure is correct; `Literal["classic","modern","split"]` validation is properly handled by Pydantic — invalid layout values will return 422 automatically.
- WeasyPrint guard (503 on missing library) is correct and well-commented.
- 500 wrapping for WeasyPrint render failure is correct.
- `generatePDF` in `api.ts` correctly handles the binary blob response (does not call `res.json()`).
- `pdfError` state is displayed in the UI.
- `pdfLoading` disables the button and shows a spinner.
- "Copy Tailored CV" button and `handleCopy` are unaffected by PDF changes.
- `handleTailor` existing flow is unchanged.
- No `any` types introduced in `api.ts` or `CVPreview.tsx` (`unknown` cast used correctly in `uploadPDF`).
- All hooks (`useState`) are declared before any conditional returns in `TailorSection.tsx`.
- No `console.log` in production code.
- Dark-theme colors in `TailorSection.tsx` are consistent with CLAUDE.md spec (`#0f172a`/`#1e293b`/`#334155` not directly used in this component, but the component follows the existing app-wide theme established before this feature).
- Empty `cv_text`: `parse_cv("")` returns `{name:"", title:"", lines:[]}` — both Python and TypeScript handle this gracefully; rendered HTML will just show an empty document.
