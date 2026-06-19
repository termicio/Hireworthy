# Raport: PDF Upload / Tailor CV / Heatmap
**Data:** 2026-06-19
**Pliki:** backend/routes/pdf.py, backend/routes/tailor.py, backend/ai.py, backend/models.py, backend/main.py, frontend/lib/api.ts, frontend/components/CvInput.tsx, frontend/components/TailorSection.tsx, frontend/components/HeatmapGrid.tsx, frontend/app/analyse/page.tsx, frontend/app/dashboard/page.tsx

---

## Przegląd (reviewer)

### Critical (must fix before ship)

**[KRYTYCZNY] backend/ai.py, linia 67 i 98 — synchroniczne wywołania Anthropic API w funkcjach `async`**
Zarówno `analyse_cv`, jak i `tailor_cv` są zadeklarowane jako `async def`, ale wywołują `client.messages.create(...)` (synchroniczne SDK). Blokuje to event loop FastAPI przez cały czas oczekiwania na odpowiedź AI (potencjalnie kilkanaście sekund). Przy większym obciążeniu całkowicie paraliżuje serwer. Poprawka: użyć `AsyncAnthropic` i `await client.messages.create(...)` albo `asyncio.to_thread`.

**[KRYTYCZNY] backend/ai.py, linia 7 — import `TailorResponse` nieużywany i mylący**
`TailorResponse` jest importowany z `models`, ale `tailor_cv` zwraca `str`, nie `TailorResponse`. Import nie powoduje błędu działania, ale sugeruje, że funkcja może zwracać obiekt, a nie string — to dezorientuje i może prowadzić do błędów przy refaktorze.

**[KRYTYCZNY] backend/routes/pdf.py, linia 15 — walidacja Content-Type niewystarczająca (OR zamiast AND)**
Warunek `if not (is_pdf_type or is_pdf_ext)` oznacza, że plik przejdzie walidację jeśli ma rozszerzenie `.pdf` ale dowolny Content-Type (np. `text/html`). Atakujący może wysłać plik wykonywalny z nazwą `exploit.pdf`. Powinno być: obie flagi wymagane jednocześnie, lub przynajmniej Content-Type jako główna kontrola. Rozszerzenie pliku jest trywialnie fałszowalne przez klienta.

---

### Important (should fix)

**[WYSOKI] backend/ai.py, linia 76-79 — nieskompletne usuwanie markdown fence**
Przy stripped fence `raw.split("```")[1]` bierze indeks 1. Jeśli model zwróci ` ```json\n{...}\n``` `, podciąg `[1]` będzie zawierał `json\n{...}\n`. Następnie kod usuwa tylko prefix `json`, ale nie usuwa końcowego ` ``` `. To spowoduje `json.loads` error. Poprawka: wyciąć fragment między pierwszym i ostatnim fence.

**[WYSOKI] backend/routes/pdf.py — brak limitu liczby stron PDF**
Plik ważący 4.9 MB złożony z 5000 stron (scan bez OCR, każda strona to pusta warstwa) przejdzie limit rozmiaru ale może zawiesić serwer przez iterację po wszystkich stronach w pdfplumber. Brak `max_pages` guard.

**[WYSOKI] backend/ai.py, linia 91-95 — prompt injection przez `cv` i `job_description`**
Zawartość `cv` i `job_description` jest interpolowana bezpośrednio do stringa promptu przez `str.format()`. Jeśli CV zawiera podwójne nawiasy klamrowe `{...}`, `str.format()` rzuci `KeyError` lub zinterpretuje je jako placeholder. Nawet bez złośliwości — użytkownicy często wklejają szablony z `{company}` itp. Poprawka: użyć `Template` z `string.Template` albo przekazać wartości jako osobne wiadomości w strukturze `messages`.

**[WYSOKI] frontend/components/CvInput.tsx — kolory niezgodne z konwencją CLAUDE.md**
Komponent używa `#111111`, `#222222`, `#E8FF00`, `#F5F5F5` — podczas gdy CLAUDE.md definiuje paletę: bg `#0f172a`, cards `#1e293b`, borders `#334155`, accent `#6366f1`. Strefa drag-and-drop (`#1e293b` i `#334155`) jest zgodna, ale textarea i przyciski używają innej palety niż reszta aplikacji. Niespójność wizualna z istniejącymi komponentami.

**[WYSOKI] frontend/components/TailorSection.tsx — brak walidacji przed wywołaniem API**
`handleTailor` nie sprawdza czy `cv` i `jobDescription` są niepuste przed wywołaniem API. Można uruchomić tailoring z pustym CV (jeśli użytkownik wyczyści pole po analizie). Backend dostanie puste stringi i wywoła Anthropic za darmo.

**[WYSOKI] frontend/app/dashboard/page.tsx, linia 105-106 — błędny `eslint-disable` komentarz**
Komentarz `// eslint-disable-next-line react-hooks/exhaustive-deps` nad `useMemo` jest błędny — `useMemo` zależy od `[apps]` i ta zależność jest prawidłowa. Komentarz jest zbędny i sugeruje, że ktoś wyłączył ostrzeżenie zamiast je naprawić. Powinien być usunięty.

**[WYSOKI] frontend/lib/api.ts, linia 81 — rzutowanie `as { detail?: string }` na niezaufane dane**
`err` pochodzi z `res.json()` które zwraca `unknown`. Rzutowanie `as { detail?: string }` bez walidacji to `any`-equivalent pattern, niebezpieczny przy strict TypeScript — jeśli backend zwróci inną strukturę błędu, runtime nie zgłosi błędu ale logika będzie cicha.

---

### Minor (nice to have)

**[NISKI] backend/requirements.txt — brakuje `asyncpg` lub `psycopg`**
`main.py` importuje `create_pool`/`close_pool` z `database`, ale requirements.txt nie zawiera sterownika async PostgreSQL. To może być już w pliku który nie był objęty reviewem, ale warto sprawdzić spójność.

**[NISKI] frontend/components/HeatmapGrid.tsx, linia 137 — tooltip oparty o `clientX/Y` może wychodzić poza viewport**
Tooltip używa `position: fixed` z `left: tooltip.x + 8, top: tooltip.y - 36`. Przy komórkach blisko prawej lub górnej krawędzi przeglądarki tooltip wyjdzie poza viewport. Brak clampingu.

**[NISKI] frontend/components/HeatmapGrid.tsx — brak obsługi pustej tablicy `data`**
Komponent nie renderuje żadnego stanu "brak danych" — po prostu renderuje siatkę z samymi pustymi komórkami. Nie jest to błąd, ale brak wyraźnego komunikatu dla nowego użytkownika.

**[NISKI] frontend/components/TailorSection.tsx — cicha obsługa błędu kopiowania do schowka**
`handleCopy` łapie wyjątek z `navigator.clipboard.writeText` i po cichu go ignoruje (komentarz: "silently ignore"). Użytkownik nie dostaje żadnej informacji zwrotnej o niepowodzeniu kopiowania. Powinien być wyświetlony komunikat błędu lub fallback `document.execCommand`.

**[NISKI] frontend/components/CvInput.tsx — `handleDragLeave` nie sprawdza czy opuszczamy cały drop zone**
`onDragLeave` ustawia `isDragging = false` przy każdym zdarzeniu, włącznie z przejściem kursora na element dziecka (tekst wewnątrz div). Powoduje miganie podświetlenia border podczas drag. Standardowa poprawka: sprawdzać `relatedTarget`.

**[NISKI] backend/routes/tailor.py, linia 15 — zbyt szeroki `except Exception`**
`except Exception` łapie wszystko, w tym `KeyboardInterrupt`-pochodne i błędy programistyczne. Logowanie wyjątku zostało pominięte całkowicie — nie wiadomo co poszło nie tak. Brak `console.error`-equivalent (`logging.exception`) przed re-raise.

**[NISKI] frontend/app/analyse/page.tsx, linia 220 — `matchScore={result?.match_score ?? 0}` przekazuje 0 gdy brak result**
`SaveApplicationModal` dostaje `matchScore=0` gdy `result` jest null. Jeśli modal zostanie otwarty przed analizą (co nie powinno się zdarzyć z uwagi na logikę UI, ale jest defensywnie ryzykowne), zapisze aplikację z score 0 zamiast `null`.

---

### OK (things done well)

- **pdf.py**: rozmiar pliku sprawdzany po odczycie, nie przed — poprawna kolejność (uniknięto TOCTOU).
- **CvInput.tsx**: walidacja pliku po stronie klienta (typ i rozmiar) przed wysłaniem do API — dobry UX pattern.
- **api.ts `uploadPDF`**: poprawnie nie ustawia `Content-Type: application/json` dla multipart — FormData obsługuje to automatycznie. Istniejąca funkcja `request<T>` słusznie pominięta dla upload.
- **TailorSection.tsx**: loading state i error state obecne, reset `tailoredCv` przy każdym nowym wywołaniu — poprawna logika.
- **HeatmapGrid.tsx**: czysty algorytm obliczania dat (Monday-aligned, 26 tygodni), poprawna obsługa `gridAutoFlow: "column"` dla kolumnowego layoutu heatmapy.
- **dashboard/page.tsx**: `useMemo` dla heatmapData — poprawna optymalizacja.
- **models.py**: `missing_keywords` i `suggestions` w `TailorRequest` mają domyślne wartości `[]` — nie wymuszają obecności w request body, co jest zgodne z opcjonalnym kontekstem analizy.
- **main.py**: router rejestracja czysta, prefixy poprawne.
- **Brak `console.log`** w kodzie produkcyjnym — zgodnie z konwencją.
- **Wszystkie ikony z `lucide-react`** — zgodnie z konwencją.

---

## Test-writer Report

### Wyniki pytest (22/22 passed)

```
tests/test_pdf.py::test_pdf_extract_valid_pdf PASSED
tests/test_pdf.py::test_pdf_extract_non_pdf_file PASSED
tests/test_pdf.py::test_pdf_extract_fake_extension PASSED
tests/test_pdf.py::test_pdf_extract_file_too_large PASSED
tests/test_pdf.py::test_pdf_extract_no_text_layer PASSED
tests/test_pdf.py::test_pdf_extract_multiple_pages PASSED
tests/test_pdf.py::test_pdf_extract_corrupted_pdf PASSED
tests/test_pdf.py::test_pdf_extract_whitespace_only_pdf PASSED
tests/test_pdf.py::test_pdf_extract_empty_pages PASSED
tests/test_tailor.py::test_tailor_valid_request PASSED
tests/test_tailor.py::test_tailor_with_empty_optional_fields PASSED
tests/test_tailor.py::test_tailor_missing_cv_field PASSED
tests/test_tailor.py::test_tailor_missing_job_description_field PASSED
tests/test_tailor.py::test_tailor_ai_failure PASSED
tests/test_tailor.py::test_tailor_ai_json_error PASSED
tests/test_tailor.py::test_tailor_with_special_characters PASSED
tests/test_tailor.py::test_tailor_with_long_cv_content PASSED
tests/test_tailor.py::test_tailor_with_many_missing_keywords PASSED
tests/test_tailor.py::test_tailor_empty_cv_string PASSED
tests/test_tailor.py::test_tailor_invalid_json_in_request PASSED
tests/test_tailor.py::test_tailor_response_model_validation PASSED
tests/test_tailor.py::test_tailor_timeout_scenario PASSED
22 passed, 1 warning in 0.10s
```

### Bugs found in production code
Żadnych nowych błędów nie wykryto — wszystkie problemy zgłoszone przez reviewer zostały naprawione przed uruchomieniem testów (AsyncAnthropic, magic bytes, str.replace).

### Frontend build
`npm run build` — zakończony sukcesem (TypeScript strict mode, 0 błędów).

### Pokrycie testów
- `POST /pdf/extract`: 9 testów — valid PDF, non-PDF, fake extension, file too large, no text layer, multiple pages, corrupted PDF, whitespace-only, empty pages
- `POST /tailor`: 12 testów — valid request, empty optional fields, missing required fields (422), AI failure (502), special characters, long CV, many keywords, empty CV string, invalid JSON, response model validation, timeout scenario
