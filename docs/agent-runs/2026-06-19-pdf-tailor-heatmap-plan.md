# Plan implementacji: PDF Upload + Auto-Tailor CV + Activity Heatmap

Data: 2026-06-19
Nazwa bazowa pipeline: `2026-06-19-pdf-tailor-heatmap`
Plik raportu dla reviewer/test-writer: `docs/agent-runs/2026-06-19-pdf-tailor-heatmap-raport.md`

## Cel

Dodać trzy funkcje do aplikacji Job Tracker:
1. **PDF Upload for CV** — użytkownik może wgrać plik PDF z CV zamiast wklejać tekst; backend ekstrahuje tekst (pdfplumber).
2. **Auto-Tailor CV** — po analizie użytkownik może wygenerować przepisaną wersję CV dopasowaną do oferty (Claude API), z widokiem side-by-side i przyciskiem kopiowania.
3. **Activity Heatmap** — na dashboardzie siatka aktywności (styl GitHub) pokazująca liczbę aplikacji wysłanych dziennie przez ostatnie ~6 miesięcy.

## Pliki do zmiany/utworzenia

### Backend
- `backend/models.py` — DODAĆ: `PdfExtractResponse`, `TailorRequest`, `TailorResponse`
- `backend/ai.py` — DODAĆ: stała `TAILOR_PROMPT` + funkcja `tailor_cv(...)`
- `backend/routes/pdf.py` — NOWY: router z `POST /pdf/extract` (multipart)
- `backend/routes/tailor.py` — NOWY: router z `POST /tailor` (JSON)
- `backend/main.py` — ZMIANA: import i rejestracja obu nowych routerów
- `backend/requirements.txt` — DODAĆ: `pdfplumber`, `python-multipart`

### Frontend
- `frontend/lib/api.ts` — DODAĆ: typy + `uploadPDF()`, `tailorCV()`
- `frontend/app/analyse/page.tsx` — ZMIANA: tryb input (text/pdf) + drop-zone + sekcja Auto-Tailor
- `frontend/components/HeatmapGrid.tsx` — NOWY: komponent siatki
- `frontend/app/dashboard/page.tsx` — ZMIANA: obliczenie danych heatmapy + render sekcji

Uwaga: `analyse/page.tsx` urośnie ponad limit ~100 linii — patrz Ryzyka (rozważyć wyodrębnienie podkomponentów `CvInput`/`TailorSection`).

## Kroki implementacji

### Część A — Backend PDF

**Krok 1.** `backend/requirements.txt`: dopisać dwie linie `pdfplumber` i `python-multipart` (alfabetycznie/na końcu, zgodnie z istniejącym stylem). python-multipart jest wymagany przez FastAPI do parsowania `UploadFile`.

**Krok 2.** `backend/models.py`: dodać model
```python
class PdfExtractResponse(BaseModel):
    text: str
```
Importy/styl jak w istniejących modelach (pydantic BaseModel).

**Krok 3.** Utworzyć `backend/routes/pdf.py`:
- `router = APIRouter()`
- `@router.post("/extract", response_model=PdfExtractResponse)`
- `async def extract_pdf(file: UploadFile = File(...))`
- Walidacja:
  - content-type musi być `application/pdf` LUB rozszerzenie `.pdf` (sprawdzić `file.filename`); jeśli nie → `HTTPException(400, "File must be a PDF")`
  - odczyt: `content = await file.read()`; jeśli `len(content) > 5 * 1024 * 1024` → `HTTPException(400, "File too large (max 5MB)")`. Czytamy raz do bajtów (nie strumieniowo), bo limit 5MB jest bezpieczny w pamięci.
- Ekstrakcja: `pdfplumber.open(io.BytesIO(content))`, iterować po stronach, `page.extract_text() or ""`, złączyć `"\n"`.
- Jeśli wynik po `.strip()` jest pusty → `HTTPException(400, "Could not extract text from PDF")` (np. skan/obrazy).
- Owinąć parsowanie w try/except — błąd pdfplumber → `HTTPException(400, "Invalid or corrupted PDF")`.
- Zwrócić `PdfExtractResponse(text=...)`.
- Importy: stdlib (`io`), third-party (`fastapi`, `pdfplumber`), lokalne (`models`) — rozdzielone pustą linią.

**Krok 4.** `backend/main.py`: dodać `pdf` do importu z `routes` i `app.include_router(pdf.router, prefix="/pdf", tags=["pdf"])`.

### Część B — Backend Tailor

**Krok 5.** `backend/models.py`: dodać
```python
class TailorRequest(BaseModel):
    cv: str
    job_description: str
    missing_keywords: list[str] = []
    suggestions: list[str] = []

class TailorResponse(BaseModel):
    tailored_cv: str
```

**Krok 6.** `backend/ai.py`: dodać stałą `TAILOR_PROMPT` (instrukcja: przepisz CV pod ofertę, naturalnie wpleć brakujące słowa kluczowe, NIE wymyślaj fałszywych doświadczeń/dat/firm, zachowaj prawdziwość, zwróć tylko tekst CV bez komentarzy) oraz funkcję:
```python
async def tailor_cv(cv: str, job_description: str,
                    missing_keywords: list[str],
                    suggestions: list[str]) -> str: ...
```
- Wywołanie klienta anthropic identycznie jak istniejące AI calls (ten sam model, message role=user).
- WAŻNE: w przeciwieństwie do analyse, tutaj odpowiedź to czysty tekst CV, NIE JSON. Nie parsować JSON — zwrócić `response.content[0].text.strip()` (dopasować do faktycznego kształtu odpowiedzi używanego w analyse). Coder ma podejrzeć istniejącą funkcję analizy w `ai.py`, by użyć tego samego sposobu odczytu tekstu i tego samego klienta/modelu.

**Krok 7.** Utworzyć `backend/routes/tailor.py`:
- `router = APIRouter()`
- `@router.post("/", response_model=TailorResponse)` (prefix `/tailor` w main.py → endpoint `POST /tailor/`)
- `async def tailor(req: TailorRequest)`
- Wywołać `await ai.tailor_cv(req.cv, req.job_description, req.missing_keywords, req.suggestions)`
- try/except wokół wywołania AI → `HTTPException(502, "AI tailoring failed")` (wzór obsługi błędów AI jak w analyse route).
- Zwrócić `TailorResponse(tailored_cv=...)`.

**Krok 8.** `backend/main.py`: dodać `tailor` do importu i `app.include_router(tailor.router, prefix="/tailor", tags=["tailor"])`.

### Część C — Frontend API

**Krok 9.** `frontend/lib/api.ts`:
- Dodać typy:
```ts
export interface PdfExtractResult { text: string; }
export interface TailorResult { tailored_cv: string; }
```
- `uploadPDF(file: File): Promise<PdfExtractResult>` — NIE używać helpera `request` (on wymusza `Content-Type: application/json`). Zrobić osobny `fetch` z `FormData` (przeglądarka sama ustawi boundary; NIE ustawiać ręcznie Content-Type), POST do `/pdf/extract`, pole `"file"`. Obsłużyć `!res.ok` tak samo jak `request` (czytać `err.detail`). To jest jedyny dozwolony wyjątek od reguły "fetch tylko w lib/api.ts" — i tak jest w lib/api.ts, więc OK.
- `tailorCV(req: { cv; job_description; missing_keywords; suggestions }): Promise<TailorResult>` — przez helper `request`, POST `/tailor/`.

### Część D — Frontend Analyse (PDF + Tailor)

**Krok 10.** `frontend/app/analyse/page.tsx` — tryb wejścia CV:
- Nowe stany: `cvInputMode: 'text' | 'pdf'` (domyślnie `'text'`), `pdfUploading: boolean`, `pdfError: string | null`, `pdfFilename: string | null`, `isDragging: boolean`.
- Nad textareą CV: dwa przyciski toggle "Paste text" | "Upload PDF" (aktywny = accent `#E8FF00`, nieaktywny = border `#222222`).
- W trybie `'pdf'`: div drop-zone z `onDragOver` (preventDefault + setIsDragging(true)), `onDragLeave`, `onDrop` (preventDefault, wziąć `e.dataTransfer.files[0]`). Plus ukryty `<input type="file" accept="application/pdf">` wyzwalany kliknięciem strefy.
- Handler pliku: walidacja po stronie klienta (typ pdf, <5MB) → ustaw `pdfError` jeśli źle; inaczej `setPdfUploading(true)`, `uploadPDF(file)`, w sukcesie `setCv(text)` + `setCvInputMode('text')` + `setPdfFilename(file.name)`, w catch `setPdfError(e.message)`, finally `setPdfUploading(false)`.
- Po udanym uploadzie (gdy `pdfFilename` ustawione, tryb 'text'): pokazać "Loaded: <filename>" + link "Change file" (czyści filename, przełącza na 'pdf').
- Spinner podczas `pdfUploading` (wzór: warunkowy spinner jak istniejący loading).
- Reszta flow analizy (POST /analyse) bez zmian.

**Krok 11.** `frontend/app/analyse/page.tsx` — sekcja Auto-Tailor (renderowana tylko gdy istnieje wynik analizy `result`):
- Nowe stany: `tailoring: boolean`, `tailoredCv: string | null`, `tailorError: string | null`, `copied: boolean`.
- Nagłówek "AUTO-TAILOR YOUR CV" + subtext (styl jak inne nagłówki sekcji).
- Przycisk "TAILOR CV" (primary, `#E8FF00` tło, czarny tekst). onClick: `setTailoring(true)`, wywołać `tailorCV({ cv, job_description: jd, missing_keywords: result.missing_keywords, suggestions: result.suggestions })`, sukces → `setTailoredCv(res.tailored_cv)`, catch → `setTailorError`, finally → `setTailoring(false)`.
- Podczas `tailoring`: tekst "Rewriting your CV..." + spinner, przycisk disabled.
- Po sukcesie: dwa panele side-by-side (CSS grid 2 kolumny, na mobile stack/1 kolumna): lewy "Original" (`cv`), prawy "Tailored" (`tailoredCv`), oba scrollowalne, whitespace zachowany (`whiteSpace: 'pre-wrap'`).
- Przycisk "COPY TAILORED CV": `navigator.clipboard.writeText(tailoredCv)`, ustaw `copied=true` na ~2s (setTimeout) i pokaż "Copied!".
- `tailorError` → komunikat błędu pod przyciskiem.

### Część E — Frontend Heatmap

**Krok 12.** Utworzyć `frontend/components/HeatmapGrid.tsx`:
- Props: `data: { date: string; count: number }[]` (date w formacie `YYYY-MM-DD`).
- Logika siatki: ostatnie 26 tygodni. Wyznaczyć datę startową = poniedziałek tygodnia sprzed 25 tygodni (lub niedziela — wybrać konsekwentnie, opisać). Zbudować `Map<string, number>` data→count dla szybkiego lookupu.
- Render: kolumny = tygodnie (26), w kolumnie 7 komórek (dni tyg.). Komórka: kwadrat ~12px, `borderRadius`, kolor wg count: `0→#1a1a1a`, `1→#4a5a00`, `2→#8aaa00`, `>=3→#E8FF00` (inline style — zgodne z konwencją dla dynamicznych kolorów).
- Etykiety miesięcy nad siatką (gdy pierwszy tydzień miesiąca się zmienia).
- Etykiety dni Mon/Wed/Fri po lewej.
- Tooltip na hover: stan `hovered: { date; count } | null`, pokazać "N applications on Month DD" (np. "2 applications on Jun 14"; uwaga na liczbę pojedynczą "1 application"). Pozycjonowanie absolutne względem komórki lub prosty tytuł.
- Bez bibliotek zewnętrznych. Pilnować limitu ~100 linii — jeśli przekroczy, wydzielić helper dat do osobnej funkcji w tym samym pliku lub `lib/`.

**Krok 13.** `frontend/app/dashboard/page.tsx`:
- Import `HeatmapGrid`.
- Obliczyć `heatmapData` z istniejącej tablicy `applications` (useMemo): grupować po dacie z `created_at` (wziąć część daty `YYYY-MM-DD`, uwaga na strefę czasową — patrz Ryzyka), zliczyć liczbę aplikacji na dzień → tablica `{ date, count }`.
- Sekcja pod wykresami: nagłówek "ACTIVITY", subtext "Applications submitted per day — last 6 months", render `<HeatmapGrid data={heatmapData} />`.
- Zachować istniejące loading/error states strony.

## Ryzyka i na co uważać

1. **AGENTS.md frontendu ostrzega**, że ta wersja Next.js ma breaking changes względem wiedzy treningowej — coder powinien zajrzeć do `node_modules/next/dist/docs/` przed pisaniem komponentów/stron, zwłaszcza dot. `"use client"`, hooków i konwencji App Router.
2. **`uploadPDF` i Content-Type**: NIE ustawiać ręcznie `Content-Type` przy FormData — przeglądarka musi sama dodać boundary. Helper `request` wymusza JSON, więc dla uploadu konieczny osobny fetch.
3. **python-multipart wymagany** — bez niego FastAPI rzuci błąd przy `UploadFile`. Łatwo przeoczyć.
4. **PDF bez warstwy tekstowej** (skan/obraz) → pusty tekst; obsłużyć jako 400 z jasnym komunikatem, nie zwracać pustego sukcesu.
5. **Limit 5MB** walidować po obu stronach (klient = szybki UX, serwer = bezpieczeństwo). Serwer jest źródłem prawdy.
6. **Tailor nie zwraca JSON** — odpowiedź to czysty tekst. Nie kopiować ślepo parsowania JSON z analyse, inaczej crash.
7. **Halucynacje w Tailor**: prompt musi zakazać wymyślania nieprawdziwych faktów/dat/firm. To kwestia etyczna i jakościowa.
8. **Strefa czasowa heatmapy**: `created_at` z backendu jest najpewniej UTC; grupowanie po lokalnej dacie vs UTC może przesunąć aplikacje o dzień. Wybrać jedną metodę (sugestia: konsekwentnie część daty z ISO stringa) i odnotować.
9. **Pusta heatmapa**: gdy `applications` puste — siatka ma się renderować jako same komórki "0", bez crasha (brak `data` → traktować jak `[]`).
10. **Limit ~100 linii**: `analyse/page.tsx` po dodaniu dwóch funkcji prawie na pewno przekroczy limit. Zalecane wydzielenie `CvInput` (toggle + drop-zone) i `TailorSection` do osobnych komponentów. Coder powinien to rozważyć; jeśli zostawia w jednym pliku, reviewer to zgłosi.
11. **clipboard API**: `navigator.clipboard` wymaga secure context (localhost OK). Dodać fallback/komunikat w catch.
12. **CORS dla multipart** — obecny middleware ma `allow_methods=["*"]` i `allow_headers=["*"]`, więc upload powinien przejść; zweryfikować przy teście ręcznym.
13. **Drag-and-drop**: pamiętać o `preventDefault` w `onDragOver` ORAZ `onDrop`, inaczej przeglądarka otworzy plik w nowej karcie.

## Następne kroki pipeline

Po akceptacji planu: coder implementuje wg kroków, następnie reviewer i test-writer dopisują do `docs/agent-runs/2026-06-19-pdf-tailor-heatmap-raport.md`.
