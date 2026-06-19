# Plan implementacji: PDF Export z live preview i 3 szablonami layoutu

Data: 2026-06-19
Slug bazowy: `2026-06-19-pdf-export`
Plik raportu dla reviewer/test-writer: `docs/agent-runs/2026-06-19-pdf-export-raport.md`

## Cel

Dodać funkcję eksportu wytailorowanego CV do PDF z poziomu `TailorSection`. Użytkownik wybiera jeden z 3 szablonów (Classic / Modern / Split) oraz kolor akcentu (5 opcji, w tym brak), widzi live preview w proporcjach A4 i pobiera gotowy PDF. Generowanie PDF odbywa się po stronie backendu (weasyprint), a preview po stronie frontendu używa tego samego HTML/CSS, aby był pixel-perfect zgodny z wynikowym plikiem.

Kluczowa zasada spójności: logika parsowania CV i budowania HTML musi być identyczna w backendzie (`pdf_templates.py`, Python) i we frontendzie (`CVPreview.tsx`, TypeScript). Każda rozbieżność = preview kłamie. Coder MUSI utrzymać te dwie implementacje 1:1 (te same reguły wykrywania nagłówków/bulletów, te same wartości CSS).

## Pliki do zmiany/utworzenia

| Plik | Akcja |
|------|-------|
| `backend/models.py` | Dodać `PDFGenerateRequest` + importy `Literal`, `Optional` (jeśli brak) |
| `backend/pdf_templates.py` | NOWY — parser CV + `build_html()` z 3 layoutami |
| `backend/routes/pdf.py` | Dodać endpoint `POST /generate` (finalny URL `/pdf/generate`) |
| `backend/requirements.txt` | Dodać `weasyprint` + komentarz o GTK3 na Windows |
| `frontend/lib/api.ts` | Dodać `generatePDF()` (raw fetch, zwraca Blob) |
| `frontend/components/CVPreview.tsx` | NOWY — `buildPreviewHtml()` + komponent preview |
| `frontend/components/TailorSection.tsx` | Dodać 4 stany + `handleDownloadPDF` + sekcję UI eksportu |

## Kroki implementacji

### Krok 1 — `backend/models.py`

Najpierw sprawdzić istniejące importy na górze pliku. Dopisać do importów z `typing` brakujące `Literal`, `Optional` (nie duplikować, jeśli już są).

Dodać model na końcu sekcji modeli:

```python
class PDFGenerateRequest(BaseModel):
    cv_text: str
    layout: Literal["classic", "modern", "split"]
    color: Optional[str] = None
```

Zakres: tylko ten model + importy. Nie ruszać innych modeli.

### Krok 2 — `backend/pdf_templates.py` (NOWY)

Sygnatury:

```python
from typing import Optional, TypedDict

class CVLine(TypedDict):
    type: str   # "header" | "bullet" | "body"
    text: str

class ParsedCV(TypedDict):
    name: str
    title: str
    lines: list[CVLine]

def _escape(text: str) -> str: ...
def parse_cv(cv_text: str) -> ParsedCV: ...
def build_html(cv_text: str, layout: str, color: Optional[str]) -> str: ...
```

**Reguły `_escape`** (kolejność ważna):
`text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")`
Uwaga: `&` MUSI być pierwsze, inaczej podwójne escapowanie encji. (Spec sugerował tylko `<`/`>`, ale `&` trzeba dodać, bo inaczej `&lt;` z danych użytkownika zostanie błędnie odtworzone — to korekta wobec specu, opisana też w Ryzykach.)

**Reguły `parse_cv`** (identyczne muszą być w TS):
1. Podziel na linie po `\n`, zrób `strip()` na każdej, odrzuć puste.
2. Jeśli brak linii → `name=""`, `title=""`, `lines=[]`.
3. `name` = pierwsza niepusta linia.
4. `title` = druga niepusta linia (jeśli istnieje, inaczej `""`).
5. Pozostałe linie (od 3. wzwyż) klasyfikuj:
   - **header**: linia w całości ALL CAPS (po usunięciu spacji/znaków interpunkcyjnych przynajmniej jedna litera i wszystkie litery wielkie) LUB następna linia to `---`/`===` (markdown underline) — w tym drugim wariancie linię `---` POMIŃ (nie dodawaj jako osobny wpis).
   - **bullet**: linia zaczyna się od `•`, `-`, lub `*` (po stripie). Usuń marker i wiodące spacje, zapisz czysty tekst.
   - **body**: cała reszta.
6. Każdy `text` w wynikowych liniach oraz `name`/`title` przepuść przez `_escape` PRZED wstawieniem do HTML (escapowanie robić w build_html przy renderze, nie w parserze — żeby preview TS i backend escapowały identycznie; ustalmy: parser zwraca surowy tekst, `build_html` escapuje). Spójnie zrób tak samo w TS.

Doprecyzowanie wykrywania ALL CAPS dla nagłówka: traktuj linię jako header tylko jeśli ma >0 liter i `line == line.upper()` oraz długość rozsądna (np. < 60 znaków), żeby nie złapać krzyczących zdań. Coder: użyj progu długości 60.

**`build_html`** — zwraca pełny `<!DOCTYPE html>` z osadzonym `<style>`. Wybór koloru akcentu: `accent = color if color else <fallback per layout>`. Strona A4: `@page { size: A4; margin: 0; }` + kontener `794px × 1123px`.

Struktura każdego szablonu (wartości CSS są wiążące — coder musi je odwzorować też w TS):

**Classic** (serif, wyśrodkowany):
- font-family: Georgia, serif; padding strony ~48px
- name: 28px bold, `color: accent || #1a1a1a`, text-align center
- title/contact: 12px, #444, center
- `<hr>` cienki w kolorze akcentu pod headerem
- section header: 11px uppercase bold, letter-spacing 1px, margin-top 18px; pod każdym header cienki `<hr>` w akcencie
- bullet: lista z wcięciem ~16px, 11px, #222, `• ` przed tekstem
- body: 11px, #222

**Modern** (sans-serif, lewy):
- font-family: Arial, Helvetica, sans-serif; padding ~48px
- name: 32px bold, text-align left, `border-left: 3px solid accent`, padding-left 12px, `color: #111`
- contact/title: 10px #666
- section header: 10px uppercase bold, `border-bottom: 2px solid accent`, padding-bottom 4px, margin-top 20px
- body: 10px #333; bullets 10px #333 z wcięciem

**Split** (dwie kolumny):
- kontener flex/grid: lewa 32%, prawa 68%
- lewa kolumna: tło `rgba(accent, 0.08)` jeśli accent podany, inaczej `#f5f5f5`; padding 24px; zawiera name (20px bold #111), contact, oraz sekcję "Skills" jeśli istnieje wśród nagłówków
- prawa kolumna: padding 24px; wszystkie pozostałe sekcje
- section header: 9px uppercase bold, `color: accent` (lub #333 gdy brak), letter-spacing 1px
- body/bullets: 9px #333
- Routing sekcji: po sparsowaniu pogrupuj `lines` w sekcje (header rozpoczyna nową grupę; treść przed pierwszym headerem to grupa "intro"). Sekcja, której nagłówek zawiera słowo "SKILL" (case-insensitive) → lewa kolumna. Reszta → prawa. Intro idzie do prawej.

Uwaga: grupowanie w sekcje przyda się też dla Classic/Modern przy renderze `<hr>` per sekcja, ale tam wystarczy iterować po `lines` sekwencyjnie. Dla Split grupowanie jest wymagane. Zaimplementuj jeden helper `group_sections(parsed)` używany przez Split (i opcjonalnie pozostałe). Ten sam helper musi powstać w TS.

### Krok 3 — `backend/routes/pdf.py`

Dopisać importy: `from fastapi import Response` (jeśli brak), `from models import PDFGenerateRequest`, `from pdf_templates import build_html`. Sprawdzić styl istniejących importów w tym pliku i naśladować (względne vs absolutne).

Import weasyprint owinąć tak, by brak biblioteki nie wywalał całego routera przy starcie:

```python
try:
    from weasyprint import HTML
    _WEASYPRINT_OK = True
except Exception:
    HTML = None
    _WEASYPRINT_OK = False
```

Endpoint:

```python
@router.post("/generate")
async def generate_pdf(req: PDFGenerateRequest):
    if not _WEASYPRINT_OK:
        # Na Windows weasyprint wymaga GTK3 runtime; patrz requirements.txt.
        # Fallback opcjonalny: pdfkit + wkhtmltopdf.
        raise HTTPException(status_code=503, detail="PDF engine unavailable (weasyprint/GTK3 not installed)")
    html = build_html(req.cv_text, req.layout, req.color)
    try:
        pdf_bytes = HTML(string=html).write_pdf()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=hireworthy-cv.pdf"},
    )
```

Zakres: nie ruszać istniejącego `/extract`. `HTTPException` zaimportować jeśli nie ma.

### Krok 4 — `backend/requirements.txt`

Dopisać linię:
```
weasyprint  # PDF generation. Windows: requires GTK3 runtime (https://github.com/tschoonj/GTK-for-Windows-Runtime-Installer). Fallback option: pdfkit + wkhtmltopdf.
```
Nie przypinać wersji jeśli reszta pliku nie przypina; jeśli przypina — coder dobierze aktualną stabilną.

### Krok 5 — `frontend/lib/api.ts`

Użyć zmiennej bazowej `API_URL` (NIE API_BASE). Wzorować się na istniejącym `uploadPDF()` (raw fetch). Dodać na końcu pliku:

```typescript
export async function generatePDF(req: {
  cv_text: string;
  layout: "classic" | "modern" | "split";
  color: string | null;
}): Promise<Blob> {
  const res = await fetch(`${API_URL}/pdf/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "PDF generation failed" }));
    throw new Error((err as { detail?: string }).detail ?? "PDF generation failed");
  }
  return res.blob();
}
```

Bez `any`. Eksportować również wspólny typ layoutu, jeśli wygodnie:
`export type PDFLayout = "classic" | "modern" | "split";` i użyć go w sygnaturze oraz w `CVPreview`/`TailorSection`, żeby uniknąć powtarzania union literalu.

### Krok 6 — `frontend/components/CVPreview.tsx` (NOWY)

`"use client"` na górze (komponent renderuje DOM po stronie klienta; nawet bez hooków zostawić dla spójności, a `dangerouslySetInnerHTML` jest klientowe). Import typu: `import type { PDFLayout } from "@/lib/api";` (lub lokalny union).

Eksportować:
```typescript
export function buildPreviewHtml(cvText: string, layout: PDFLayout, color: string | null): string
```
— PORT 1:1 backendowego `build_html` + `parse_cv` + `group_sections` + `_escape`. Te same progi (długość 60 dla header), te same markery bulletów (`•`, `-`, `*`), te same wartości CSS. Coder: implementować równolegle z krokiem 2, najlepiej kopiując strukturę.

Komponent:
```typescript
type CVPreviewProps = { cvText: string; layout: PDFLayout; color: string | null };
export default function CVPreview({ cvText, layout, color }: CVPreviewProps)
```

Render:
- Label nad podglądem: "PREVIEW" — small, uppercase, muted (`#666666`).
- Zewnętrzny wrapper: `width: 301px; height: 427px; overflow: hidden;` + border `#222222`, tło `#F5F5F5`.
- Wewnątrz: `<div>` z `width: 794px; height: 1123px; transform: scale(0.38); transformOrigin: "top left";` i `dangerouslySetInnerHTML={{ __html: html }}` gdzie `html = buildPreviewHtml(...)`.
- `794*0.38 = 301.72` → użyć 301px (lub 302). `1123*0.38 = 426.74` → 427px. Wartości jako liczby w inline style (konwencja: inline styles dla wartości dynamicznych).

Uwaga o leakage CSS: HTML z `buildPreviewHtml` zawiera `<style>` z generycznymi selektorami. Aby `<style>` z podglądu nie wyciekł na całą stronę, build dla PREVIEW powinien scope'ować reguły pod kontener (np. wszystkie selektory prefiksowane klasą wrappera) ALBO — preferowany, prostszy i w pełni izolowany wariant — renderować w `<iframe>`:
```tsx
<iframe srcDoc={html} style={{ width: 794, height: 1123, transform: "scale(0.38)", transformOrigin: "top left", border: "none" }} title="CV preview" />
```
DECYZJA: użyć `<iframe srcDoc>`. Eliminuje to ryzyko XSS na hoście (sandbox) i wyciek CSS, a `html` jest dokładnie tym samym stringiem co preview/backend. Dodać `sandbox=""` (bez allow-scripts) dla izolacji. To zmienia rekomendację ze specu (`dangerouslySetInnerHTML`) — uzasadnienie w Ryzykach.

### Krok 7 — `frontend/components/TailorSection.tsx`

Wszystkie nowe `useState` zadeklarować NA GÓRZE komponentu, przed jakimkolwiek warunkowym renderem/return (zgodnie z auto-memory: hooks przed early returns).

Nowe stany (po `copied`):
```typescript
const [selectedLayout, setSelectedLayout] = useState<PDFLayout>("modern");
const [selectedColor, setSelectedColor] = useState<string | null>("#1B2A4A");
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfError, setPdfError] = useState<string | null>(null);
```

Importy: `generatePDF`, typ `PDFLayout` z `@/lib/api`; `CVPreview` z `./CVPreview` (lub `@/components/CVPreview`); `Loader2` z `lucide-react` (jeśli nie zaimportowany).

Handler:
```typescript
async function handleDownloadPDF() {
  if (!tailoredCv) return;
  setPdfLoading(true);
  setPdfError(null);
  try {
    const blob = await generatePDF({
      cv_text: tailoredCv,
      layout: selectedLayout,
      color: selectedColor,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hireworthy-cv.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    setPdfError(err instanceof Error ? err.message : "PDF generation failed");
    console.error(err);
  } finally {
    setPdfLoading(false);
  }
}
```

UI (renderowane tylko gdy `tailoredCv !== null`, poniżej istniejącego przycisku "Copy Tailored CV →"):
- Separator (cienka linia `#222222`).
- Nagłówek "EXPORT AS PDF" — ten sam styl co istniejące "AUTO-TAILOR YOUR CV".
- Subtext: "Choose a layout and colour, then download your tailored CV." (`#666666`).
- Layout selector — 3 przyciski (Classic / Modern / Split):
  - aktywny: `background: #E8FF00; color: #080808;`
  - nieaktywny: `border: 1px solid #222222; color: #666666; background: transparent;`
  - klik → `setSelectedLayout(value)`.
- Color selector — 5 swatchy (kółka 20px):
  - `#1B2A4A` (Midnight Navy), `#2D5016` (Forest), `#6B2737` (Burgundy), `#4A5568` (Slate), oraz `null` ("none").
  - selected: `border: 2px solid #E8FF00`; nieselected: `border: 1px solid #333` (lub brak).
  - swatch "none": kółko `background: #666666` z białą ukośną kreską (np. linear-gradient lub overlay `<span>` obrócony 45deg). Porównanie wyboru: `selectedColor === value` gdzie value dla none to `null`.
  - klik → `setSelectedColor(value)`.
- `<CVPreview cvText={tailoredCv} layout={selectedLayout} color={selectedColor} />`.
- Przycisk "DOWNLOAD PDF →": full width, `background: #E8FF00`, czarny tekst; `disabled={pdfLoading}`; `onClick={handleDownloadPDF}`.
  - gdy `pdfLoading`: tekst "Generating PDF..." + `<Loader2>` z animacją spin.
- gdy `pdfError`: komunikat błędu na czerwono.

Limit ~100 linii na komponent: TailorSection przekroczy go po dodaniu UI. Mitigacja: ciężki preview jest już wydzielony do `CVPreview`. Jeśli sekcja eksportu robi się duża, coder może wydzielić `PdfExportControls.tsx` (layout+color+download), ale to opcjonalne — preferowane jeśli plik przekracza ~180 linii.

## Ryzyka i na co uważać

1. **weasyprint na Windows (GTK3).** `pip install` może przejść, ale `HTML().write_pdf()` rzuci przy braku GTK3. Mitigacja: import owinięty w try/except + endpoint zwraca 503 z czytelnym detailem, runtime owinięty w try/except → 500 z treścią błędu. Komentarz w requirements.txt z linkiem do GTK3 i wzmianką o fallbacku pdfkit+wkhtmltopdf. Frontend pokaże `pdfError` z detailem — UI się nie wywali.

2. **Rozjazd parser/CSS backend (Python) vs frontend (TS).** Największe ryzyko jakościowe. Reguły wykrywania nagłówków, bulletów, próg długości 60, markery `• - *`, wartości CSS i scoping kolorów MUSZĄ być identyczne. Coder: implementować Krok 2 i `buildPreviewHtml` (Krok 6) jednocześnie, traktując je jako jedno źródło prawdy. Test-writer: warto dodać test porównujący strukturę dla wspólnego sampla.

3. **XSS / wstrzyknięcie HTML.** `cv_text` pochodzi od użytkownika (wpisany lub z PDF). Cały tekst użytkownika MUSI być escapowany (`& < >`) przed wstawieniem do HTML — zarówno w backendzie, jak i w `buildPreviewHtml`. Dodatkowo preview renderowany w `<iframe srcDoc sandbox="">` (bez allow-scripts) izoluje wykonanie. To korekta wobec specu (`dangerouslySetInnerHTML`): iframe daje sandbox + brak wycieku `<style>` na hosta. Jeśli iframe sprawi problem z proporcjami, dopuszczalny fallback to `dangerouslySetInnerHTML` z CSS scope'owanym pod unikalną klasę wrappera — wtedy escapowanie jest jedyną ochroną i musi być bezwzględne.

4. **Escapowanie `&` w parserze.** Spec wymieniał tylko `<`/`>`. Trzeba dodać `&` jako pierwsze w kolejności replace, inaczej znaki `&` w CV zepsują encje. Opisane w Kroku 2.

5. **Transform scale w preview wymaga jawnych wymiarów wrappera.** Bez `width/height` na zewnętrznym kontenerze (301×427) layout się zapadnie. `transformOrigin: "top left"` krytyczny. `overflow: hidden` na wrapperze.

6. **Hooks przed early returns** (auto-memory). TailorSection obecnie nie ma early returnów, ale 4 nowe `useState` deklarować na samej górze, przed jakimkolwiek warunkowym renderem.

7. **Pusty/minimalny `cv_text`.** Parser musi obsłużyć: pusty string, 1 linię (tylko name), brak sekcji. Nie wywalać indeksami. Split bez sekcji "Skills" → lewa kolumna pokazuje tylko name+contact.

8. **Layout "split" — routing sekcji.** Wymaga grupowania w sekcje (`group_sections`). Treść przed pierwszym nagłówkiem (intro) → prawa kolumna. Sekcja zawierająca "SKILL" → lewa. Ten sam helper w TS.

9. **Spójność URL.** Endpoint to `/pdf/generate` (router prefix `/pdf` + `/generate`). Frontend `${API_URL}/pdf/generate`. `API_URL`, nie `API_BASE`.

10. **`copied` vs nowe stany.** Nie kolidować z istniejącą logiką kopiowania; sekcja eksportu jest dodatkiem pod przyciskiem Copy, w tym samym bloku `tailoredCv !== null`.

## Kolejność implementacji (dla codera)

1. `backend/models.py`
2. `backend/pdf_templates.py` (parser + 3 layouty + group_sections + escape)
3. `backend/routes/pdf.py` (POST /generate, guard weasyprint)
4. `backend/requirements.txt`
5. `frontend/lib/api.ts` (generatePDF + typ PDFLayout)
6. `frontend/components/CVPreview.tsx` (buildPreviewHtml — PORT 1:1 z kroku 2 — + komponent z iframe)
7. `frontend/components/TailorSection.tsx` (4 stany + handler + UI)

Po implementacji: `npm run build` (TS + build) i `npm run lint` na froncie; backend — `uvicorn` start + `curl -X POST /pdf/generate` smoke test (akceptując możliwy 503 jeśli GTK3 brak na maszynie).
