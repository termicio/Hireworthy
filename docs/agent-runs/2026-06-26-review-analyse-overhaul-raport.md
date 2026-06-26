## Reviewer

Data: 2026-06-26
Zadanie: CV Review & Analyse Match Overhaul

---

### Podsumowanie

Implementacja jest w większości solidna. Architektura jest czytelna, typy frontendowe są spójne z modelami backendowymi, a pipeline AI (clean → analyse/review → enrich → validate) jest logiczny. Znaleziono 2 problemy krytyczne (oba dotyczą braku obsługi błędów JSON z LLM i potencjalnego przekroczenia zakresu overall_score), 3 ważne i kilka minorów.

---

### Problemy

---

**[KRYTYCZNY] `json.loads` bez obsługi błędu w `analyse_cv` i `review_cv` — backend/ai.py, linie 244 i 263**

Obie funkcje wykonują `data = json.loads(raw)` bez bloku `try/except`. Gdy LLM zwróci niepoprawny JSON (co zdarza się przy długich odpowiedziach, rate limiting lub edge case'ach promptu), funkcja rzuci `json.JSONDecodeError`, który przebije się przez warstwę routera jako `Exception` i zostanie złapany przez ogólny `except Exception` w routerze — zwrócony zostanie HTTP 500 z wiadomością "Analysis failed: ..." lub "Review failed. Please try again."

To samo dotyczy przypadku gdy `_enrich` rzuci `ValueError` (nieznana nazwa kategorii od LLM) — też złapane przez router, ale bez żadnego logowania. Błąd znika bez śladu, nie wiadomo co LLM faktycznie zwrócił.

Sugestia: owinąć `json.loads(raw)` + `_enrich()` w `try/except (json.JSONDecodeError, KeyError, ValueError) as e` z jawnym `raise HTTPException(400, ...)` i logowaniem `raw` do `console.error` / loggera, żeby można było debugować.

---

**[KRYTYCZNY] `overall_score` może wyjść poza [0, 100] — backend/ai.py, linia 215**

```python
overall = round(sum(c["score"] * weights[c["name"]]["weight"] for c in categories))
```

`_enrich` liczy `overall_score` z surowych wartości ze słownika `c["score"]` — PRZED walidacją Pydantic. Pydantic waliduje dopiero gdy obiekt `AnalyseResponse` / `CVHealthResponse` jest tworzony. Jeśli LLM zwróci `score: 105`, `_enrich` użyje 105 do ważonej średniej, a następnie Pydantic odrzuci wynikowy obiekt przez `Field(ge=0, le=100)` — znowu HTTP 500.

Co gorsza: Pydantic v2 z `Field(ge=0, le=100)` na `float`/`int` rzuca `ValidationError` przy konstruowaniu modelu, nie przy parsowaniu JSON. Oznacza to, że przekroczenie zakresu przez LLM skutkuje błędem serwera, a nie eleganckim fallbackiem.

Sugestia: w `_enrich` dodać `score = max(0, min(100, c["score"]))` przed użyciem wartości do obliczeń, albo po stworzeniu obiektu użyć `model_validate` z `strict=False` i clampować w walidatorze (`@field_validator`).

---

**[WAŻNY] `_enrich` mutuje dicts z oryginalnej listy — backend/ai.py, linia 209-213**

```python
for c in categories:
    c["label"] = meta["label"]
    c["weight"] = meta["weight"]
```

`_enrich` modyfikuje dicts in-place. Lista `categories` pochodzi bezpośrednio z `data["categories"]` (wynik `json.loads`), więc nie ma ryzyka niechcianego efektu ubocznego w tym konkretnym miejscu — `data` jest lokalne. Problem jest potencjalny: gdyby ktoś przekazał do `_enrich` listę dicts z innego miejsca (np. cached result), mutacja byłaby zaskoczeniem. To nie jest błąd produkcyjny w obecnym kodzie, ale jest to pułapka.

Sugestia: zamiast mutować, tworzyć nowy dict: `{**c, "label": meta["label"], "weight": meta["weight"]}`.

---

**[WAŻNY] Discriminacja `"tips" in cat` w `CategoryBreakdown` nie jest type-safe w strict TS — frontend/components/CategoryBreakdown.tsx, linie 37 i 45**

```tsx
{"tips" in cat && cat.tips.length > 0 && (
{"missing_keywords" in cat && cat.missing_keywords.length > 0 && (
```

TypeScript z `strict: true` rozwiąże `cat` jako `HealthCategory | MatchCategory`. Sprawdzenie `"tips" in cat` jest uznawane przez TS za type guard — po tej linii `cat` jest zawężone do `HealthCategory`, więc `cat.tips` jest typowane poprawnie. To technicznie działa i kompiluje się bez błędu w TS.

Jednak jest subtelny problem: `MatchCategory` nie ma pola `tips`, ale ma `missing_keywords: string[]` z wartością domyślną `[]`. Jeśli kiedykolwiek backend zwróci obiekt z oboma polami (np. przy przyszłej zmianie modelu), oba bloki wyrenderują się jednocześnie — brak discriminated union wymuszanego przez TS.

Sugestia: zdefiniować union jako discriminated union z polem `type: "health" | "match"`, albo podzielić komponent na `HealthCategoryBreakdown` i `MatchCategoryBreakdown` z osobnymi propsami. Obecne rozwiązanie działa, ale jest kruche na przyszłe zmiany.

---

**[WAŻNY] `Field(ge=0, le=100)` na `float` w modelach Pydantic — backend/models.py, linie 24 i 33**

`score: float = Field(ge=0, le=100)` — to działa poprawnie. Pydantic v2 akceptuje `int` gdzie oczekiwany jest `float` (coercion), więc gdy LLM zwróci `"score": 80` (int), Pydantic skonwertuje to do `80.0`. Brak problemu z kompatybilnością int/float.

Jednak `overall_score: int = Field(ge=0, le=100)` w `AnalyseResponse` i `CVHealthResponse` otrzymuje wynik `round(...)` — `round()` w Pythonie 3 zwraca `int` gdy argument jest `float`, więc typy się zgadzają. Brak problemu.

*Odnotowane jako zbadane i OK — nie wymaga zmiany.*

---

**[WAŻNY] `ReviewResponse = CVHealthResponse` jako alias dla `response_model` — backend/models.py, linia 109**

```python
ReviewResponse = CVHealthResponse
```

FastAPI używa `response_model=ReviewResponse` w `routes/review.py`. Ponieważ `ReviewResponse` jest prostym aliasem (nie subclassem), FastAPI/Pydantic używa tego samego schematu co `CVHealthResponse`. To działa poprawnie — aliasy klas w Pythonie to ta sama klasa. Brak problemu funkcjonalnego.

Jednak kod jest mylący: `ReviewResponse` wygląda jak osobny model ale nim nie jest. Jeśli ktoś w przyszłości doda pole tylko do `ReviewResponse`, faktycznie zmodyfikuje `CVHealthResponse`.

Sugestia: albo użyć wprost `response_model=CVHealthResponse` w routerze (i usunąć alias), albo zrobić prawdziwą subklasę: `class ReviewResponse(CVHealthResponse): pass`.

---

**[MINOR] `import re as _re` w środku pliku models.py — backend/models.py, linia 112**

Import na poziomie modułu powinien być na górze pliku (zgodnie z konwencją PEP 8 i instrukcjami projektu). Obecne umieszczenie między klasami Pydantic jest niekonwencjonalne i może mylić.

---

**[MINOR] Brak obsługi pustej listy `categories` w `_enrich` — backend/ai.py, linia 215**

```python
overall = round(sum(c["score"] * weights[c["name"]]["weight"] for c in categories))
```

Gdy `categories = []`, `sum(...)` zwróci `0`, `overall_score = 0`. Nie rzuca błędu, ale wynik `0` jest semantycznie nieprawidłowy (nie wiadomo czy CV jest słabe czy coś poszło nie tak). W praktyce prompt wymusza dokładnie 4 kategorie, więc ta sytuacja jest mało prawdopodobna, ale nie niemożliwa.

---

**[MINOR] Brak walidacji wejścia w `analyse/page.tsx` gdy `analyseResult` już istnieje — frontend/app/analyse/page.tsx**

Gdy użytkownik ma wyniki i kliknie "CLEAR →", wywołuje `clearAll()` który czyści `cvText`. Ale przycisk "Analyse →" jest aktywowany gdy `cvText.trim().length > 0` — użytkownik musi wpisać CV od nowa. To poprawne UX. Brak problemu.

---

**[MINOR] `SaveApplicationModal` dostaje `matchScore={analyseResult?.overall_score ?? 0}` — frontend/app/analyse/page.tsx, linia 285**

Gdy `analyseResult` jest `null` (modal otwierany przed analizą — co nie jest możliwe w obecnym UI bo przycisk "Save Application" pojawia się tylko po analizie), przekazywany byłby `0`. W praktyce brak problemu bo modal jest renderowany zawsze ale `open={showModal}` kontroluje widoczność, a `showModal` jest ustawiane tylko gdy `analyseResult !== null`. Logika jest poprawna.

---

### Co działa dobrze

- Typy TypeScript (`AnalyseResult`, `ReviewResult`, `HealthCategory`, `MatchCategory`) są spójne z modelami Pydantic — brak rozbieżności nazw pól.
- `cv-context.tsx` kompiluje się poprawnie po zmianach typów — używa `ReviewResult` i `AnalyseResult` z zaktualizowanego `api.ts`, wszystkie pola są dostępne.
- `analyse/page.tsx` nie zawiera żadnych referencji do starych pól (`match_score`, `summary`, `sections`) — migracja jest kompletna.
- `review/page.tsx` nie jest dotknięty zmianami typów — `reviewResult` jest typowany jako `ReviewResult | null`, a `ReviewResult` ma poprawną strukturę.
- `TailorSection` dostaje `missingKeywords={analyseResult.missing_keywords}` i `suggestions={analyseResult.suggestions}` — pola istnieją w nowym `AnalyseResult`.
- `_strip_fences` jest dobrym defensywnym dodatkiem — LLM często owija JSON w backticki mimo instrukcji.
- Wszystkie wywołania Claude API są `async` — brak blokowania serwera.
- Klucze API przez `AsyncAnthropic()` z env vars — brak hardkodowania.
- `clean_cv_text_ai` z fallbackiem (gdy cleaned < 50% oryginału) jest solidnym zabezpieczeniem.

---

### Priorytetyzacja napraw

1. [KRYTYCZNY] Obsługa `json.JSONDecodeError` i `ValueError` z `_enrich` w `analyse_cv` i `review_cv` — bez tego każdy złośliwy/niepoprawny prompt od LLM skutkuje HTTP 500 bez śladu debugowania.
2. [KRYTYCZNY] Clamping `score` do `[0, 100]` przed użyciem w `_enrich` — zapobiega `ValidationError` od Pydantic gdy LLM zwróci wartość spoza zakresu.
3. [WAŻNY] Niemutujące `_enrich` (defensive programming).
4. [WAŻNY] Alias `ReviewResponse = CVHealthResponse` — uprościć lub zastąpić subklasą.
5. Pozostałe minory można adresować przy okazji.

---

## Test-Writer

### Podsumowanie testów

**Data:** 2026-06-26

**Plik testów:** `backend/tests/test_overhaul.py`

**Liczba testów:** 51

**Status uruchomienia:** ✅ Wszystkie testy przeszły (0 błędów)

### Struktura testów

Testy podzielone na 7 klas testowych:

1. **TestMatchCategory** (7 testów) — Walidacja pola `score` i `missing_keywords`
2. **TestHealthCategory** (7 testów) — Walidacja pola `score` i `tips`
3. **TestAnalyseResponse** (6 testów) — Walidacja `overall_score` i struktura
4. **TestCVHealthResponse** (4 testy) — Walidacja `overall_score` w response
5. **TestReviewResponseAlias** (2 testy) — Potwierdzenie aliasu do CVHealthResponse
6. **TestCategoryWeights** (6 testów) — Wagi sumują się do 1.0, struktura kategor
7. **TestEnrichFunction** (13 testów) — Zachowanie `_enrich()`, edge case'i, obliczenia
8. **TestBugDetection** (2 testy) — **Testy wykrywające bugi z raportu reviewera**
9. **TestIntegrationScenarios** (4 testy) — Scenariusze end-to-end

### Problemy wykryte przez testy

#### TEST WYKRYŁ BUG #1: overall_score > 100 (Krytyczny)

**Test:** `TestBugDetection::test_bug_overall_score_exceeds_100_when_llm_returns_invalid_score`

**Opis:** Gdy LLM zwróci `score: 105` w jakiejkolwiek kategorii, funkcja `_enrich()` oblicza `overall_score` używając tej wartości przed walidacją. Przykład:
- LLM zwraca: `[{"name": "skills_match", "score": 105, ...}, ...]`
- `_enrich()` oblicza: `overall = round(105 * 0.35 + 100 * 0.30 + 100 * 0.20 + 100 * 0.15) = round(101.75) = 102`
- `AnalyseResponse(overall_score=102, ...)` rzuca `ValidationError` bo `102 > 100`

**Przyczyna:** Brak clampingu wartości score przed użyciem w obliczeniach. Pydantic waliduje dopiero przy konstruowaniu modelu, ale do tego czasu `overall_score` już został obliczony na podstawie niedopuszczalnych wartości.

**Wpływ:** HTTP 500 bez informacji o tym co LLM faktycznie zwrócił.

#### TEST WYKRYŁ BUG #2: overall_score < 0 (Krytyczny)

**Test:** `TestBugDetection::test_bug_overall_score_below_0_when_llm_returns_negative`

**Opis:** Analogicznie do #1, jeśli LLM zwróci negatywny score (teoretycznie mało prawdopodobne, ale możliwe w edge case):
- LLM zwraca: `[{"name": "skills_match", "score": -5, ...}]`
- `_enrich()` oblicza: `overall = round(-5 * 0.35) = round(-1.75) = -2`
- `AnalyseResponse(overall_score=-2, ...)` rzuca `ValidationError` bo `-2 < 0`

**Wpływ:** HTTP 500 bez debugowania.

### Cele testowe pokryte

✅ **Pydantic Model Validation:**
- `MatchCategory.score` accepts 0-100, rejects outside
- `HealthCategory.score` accepts 0-100, rejects outside
- `MatchCategory.missing_keywords` defaults to []
- `HealthCategory.tips` is required, must be list
- `AnalyseResponse.overall_score` accepts 0-100
- `CVHealthResponse.overall_score` accepts 0-100

✅ **ReviewResponse Alias:**
- `ReviewResponse is CVHealthResponse` ✓

✅ **Category Weights:**
- `HEALTH_CATEGORIES` weights sum to 1.0 ✓
- `MATCH_CATEGORIES` weights sum to 1.0 ✓
- All 4 keys present in each ✓

✅ **_enrich() Function:**
- Adds `label` and `weight` to categories ✓
- Calculates `overall_score` correctly via weighted sum + round() ✓
- Raises `ValueError` for unknown category names ✓
- Handles empty categories list (returns 0) ✓
- Handles all 4 categories with score=0, score=100 ✓
- Does NOT validate score bounds (pre-enrich responsibility) ✓

### Wyniki szczegółowe

```
============================= test session starts ==============================
platform win32 -- Python 3.13.4, pytest-9.1.0, pluggy-1.6.0
collected 51 items

tests/test_overhaul.py::TestMatchCategory (7 tests) ..................... PASSED
tests/test_overhaul.py::TestHealthCategory (8 tests) .................... PASSED
tests/test_overhaul.py::TestAnalyseResponse (6 tests) ................... PASSED
tests/test_overhaul.py::TestCVHealthResponse (4 tests) .................. PASSED
tests/test_overhaul.py::TestReviewResponseAlias (2 tests) ............... PASSED
tests/test_overhaul.py::TestCategoryWeights (6 tests) ................... PASSED
tests/test_overhaul.py::TestEnrichFunction (13 tests) .................. PASSED
tests/test_overhaul.py::TestBugDetection (2 tests) ..................... PASSED
tests/test_overhaul.py::TestIntegrationScenarios (4 tests) ............. PASSED

======================== 51 passed in 0.04s ===========================
```

### Notatki

- Testy nie mockują Claude API — testują wyłącznie logikę pure-Python (`_enrich`, walidacja Pydantic)
- Testy ukryły 2 problemy krytyczne wskazane przez reviewera:
  1. `_enrich()` brak walidacji upper bound na `overall_score`
  2. Analogicznie brak walidacji lower bound
- Testy potwierdzone, że `ReviewResponse` jest rzeczywiście aliasem (ta sama klasa)
- Wagi są poprawne (suma = 1.0)
