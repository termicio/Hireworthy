# Plan: CV Review & Analyse Match Overhaul

Nazwa bazowa pipeline: `2026-06-26-review-analyse-overhaul`
(reviewer/test-writer piszą do `docs/agent-runs/2026-06-26-review-analyse-overhaul-raport.md`)

## Cel

Przebudować dwa endpointy AI na model "kategorii ważonych":

- **POST /review** → "CV Health Check": zamiast `sections: List[SectionScore]` zwraca `categories: List[HealthCategory]` z wagami i polami `evidence`/`tips`. `overall_score` liczony deterministycznie w Pythonie jako średnia ważona, NIE przez LLM.
- **POST /analyse** → category-based match scoring: dodaje `categories: List[MatchCategory]`, zamienia `summary` → `explanation`, dodaje `overall_score` (ważony, liczony w Pythonie), zachowuje `missing_keywords`/`suggestions` na top-level.
- Frontend: nowy reużywalny `CategoryBreakdown.tsx`, aktualizacja typów i obu widoków.

## Decyzje projektowe (rozstrzygnięcia z briefu)

### 1. `match_score` vs `overall_score` (backward compat)
**Decyzja: ujednolicić na `overall_score` w całym stacku, BEZ aliasu Pydantic.**
Uzasadnienie: aplikacja nie ma auth, nie ma utrwalonych odpowiedzi API ani publicznych klientów — "backward compat" dotyczy tylko spójności frontend↔backend w tym repo, a nie zewnętrznych konsumentów. Alias (`match_score` jako duplikat) tworzyłby dwa źródła prawdy i ryzyko rozjazdu. Zamiast tego zmieniamy wszystkie odwołania `analyseResult.match_score` → `analyseResult.overall_score`.

Uwaga: pole `match_score` w modelach `ApplicationCreate`/`ApplicationOut` (zapis aplikacji do tracker) to ODRĘBNA rzecz — NIE ruszamy go. Zmieniamy tylko response analizy. W `analyse/page.tsx` przy zapisie aplikacji (`SaveApplicationModal matchScore={...}`) podajemy `analyseResult.overall_score`.

### 2. `summary` → `explanation` (rename)
**Decyzja: czysty rename, bez utrzymywania starego pola.** LLM prompt zwraca `explanation`, model Pydantic ma `explanation`, frontend renderuje `analyseResult.explanation`. Sekcja UI "Summary" zostaje (nagłówek tekstowy "Summary" może zostać lub zmienić na "Explanation" — patrz krok 9, zostawiamy nagłówek "Summary" dla minimalnej zmiany wizualnej, ale dane z `explanation`).

### 3. Kolory progress baru
W briefie CategoryBreakdown ma używać progów 0-49 / 50-74 / 75-100 (#FF3D00 / #E8FF00 / #00FF88).
Istniejący `ReviewResult.scoreColor` używa innych progów (<40 / <70). Aby uniknąć dwóch sprzecznych funkcji, `CategoryBreakdown` dostaje WŁASNĄ funkcję `barColor` z progami z briefu (50/75). Overall score w `ReviewResult` zostaje na dotychczasowym `scoreColor` (nie ruszamy go), bo brief nie wymaga zmiany koloru overall. To świadoma drobna niespójność — odnotowana w ryzykach.

## Pliki do zmiany/utworzenia

Backend:
- `backend/models.py` — nowe modele, zmiana `AnalyseResponse` i `ReviewResponse`, usunięcie `SectionScore`.
- `backend/ai.py` — przepisanie `ANALYSIS_PROMPT`, `REVIEW_PROMPT`, oraz logiki post-processingu w `analyse_cv()` i `review_cv()` (dodanie wag/labeli + wyliczenie overall_score).

Frontend:
- `frontend/lib/api.ts` — nowe interfejsy `HealthCategory`, `MatchCategory`; aktualizacja `ReviewResult`, `AnalyseResult`; usunięcie `SectionScore`.
- `frontend/components/CategoryBreakdown.tsx` — NOWY komponent.
- `frontend/components/ReviewResult.tsx` — sekcja "Section Analysis" → `CategoryBreakdown`.
- `frontend/app/analyse/page.tsx` — `match_score`→`overall_score`, `summary`→`explanation`, wstawienie `CategoryBreakdown`.
- `frontend/lib/cv-context.tsx` — bez zmian logiki (typy importowane), tylko upewnić się że kompiluje po zmianie typów.

Routery `routes/review.py` i `routes/analyse.py` — bez zmian (delegują do `ai.*`, typ zwracany wynika z modelu).

## Definicje wag i labeli (single source of truth w Pythonie)

W `backend/ai.py` (lub `backend/models.py` — preferencja: `ai.py`, blisko post-processingu) zdefiniować dwa słowniki, dla czytelności jako moduł-level stałe:

```python
HEALTH_CATEGORIES = {
    "clarity":          {"label": "Clarity",          "weight": 0.25},
    "completeness":     {"label": "Completeness",     "weight": 0.25},
    "impact_language":  {"label": "Impact Language",  "weight": 0.30},
    "ats_friendliness": {"label": "ATS Friendliness", "weight": 0.20},
}

MATCH_CATEGORIES = {
    "skills_match":          {"label": "Skills Match",          "weight": 0.35},
    "experience_relevance":  {"label": "Experience Relevance",  "weight": 0.30},
    "seniority_fit":         {"label": "Seniority Fit",         "weight": 0.20},
    "education_fit":         {"label": "Education Fit",          "weight": 0.15},
}
```

Każdy zestaw wag sumuje się do 1.0 (zweryfikować mentalnie: health 0.25+0.25+0.30+0.20=1.00; match 0.35+0.30+0.20+0.15=1.00).

## Kroki implementacji

Kolejność: backend models → ai.py → frontend types → komponent → widoki.

### Krok 1 — `backend/models.py`: nowe modele
Zakres: tylko sekcja modeli review/analyse.
1. Dodać import `Field` z pydantic (linia 1: `from pydantic import BaseModel, Field`).
2. Zastąpić `AnalyseResponse` (linie 21-26) nowym:
   ```python
   class MatchCategory(BaseModel):
       name: str
       label: str
       score: float = Field(ge=0, le=100)
       weight: float
       evidence: str
       missing_keywords: List[str] = []

   class AnalyseResponse(BaseModel):
       overall_score: int = Field(ge=0, le=100)
       categories: List[MatchCategory]
       explanation: str
       missing_keywords: List[str]
       suggestions: List[str]
   ```
   Uwaga: `matched_keywords` USUWAMY z response (brief nowego modelu go nie zawiera). Patrz ryzyko — frontend renderuje matched_keywords, trzeba zdecydować. **Decyzja: zachować `matched_keywords: List[str] = []` w modelu i w promptcie**, bo UI go pokazuje i usunięcie pogarsza UX bez powodu. To rozszerzenie ponad brief, świadome. (Jeśli orchestrator chce ściśle wg briefu — usunąć i wyciąć z UI; domyślnie zachowujemy.)
3. Usunąć klasę `SectionScore` (linie 73-77).
4. Zastąpić `ReviewResponse` (linie 89-94) i dodać `HealthCategory` przed nią:
   ```python
   class HealthCategory(BaseModel):
       name: str
       label: str
       score: float = Field(ge=0, le=100)
       weight: float
       evidence: str
       tips: List[str]

   class CVHealthResponse(BaseModel):
       overall_score: int = Field(ge=0, le=100)
       categories: List[HealthCategory]
       weak_bullets: List[WeakBullet]
       red_flags: List[str]
       quick_wins: List[str]
   ```
   Nazwa: brief używa `CVHealthResponse`. `review_cv()` w ai.py i import muszą używać `CVHealthResponse` zamiast `ReviewResponse`. Sprawdzić czy `ReviewResponse` jest importowane gdzie indziej (routes/review.py) — jeśli tak, zaktualizować import tam albo zostawić alias `ReviewResponse = CVHealthResponse`. **Decyzja: zostawić alias `ReviewResponse = CVHealthResponse`** na końcu pliku, by nie tropić wszystkich importów; to czysto wewnętrzny alias nazwy klasy, nie pola.

### Krok 2 — `backend/ai.py`: stałe wag
Dodać `HEALTH_CATEGORIES` i `MATCH_CATEGORIES` (jak wyżej) po imporcie modeli (po linii 7). Zaktualizować import linii 7:
`from models import AnalyseResponse, CVHealthResponse, MatchCategory, HealthCategory`.

### Krok 3 — `backend/ai.py`: nowy `ANALYSIS_PROMPT`
Zastąpić blok linii 11-40. Prompt musi:
- zachować __CV__ / __JD__ placeholdery,
- prosić o JSON BEZ `overall_score`, BEZ `weight`, BEZ `label`,
- kategorie po `name`: `skills_match`, `experience_relevance`, `seniority_fit`, `education_fit`,
- każda z `score` (0-100), `evidence` (jedno zdanie z dowodem), `missing_keywords` (lista per-kategoria),
- top-level `matched_keywords` (jeśli zachowujemy), `missing_keywords`, `suggestions`, `explanation`.
Szkic struktury JSON oczekiwanej w promptcie:
```json
{
  "categories": [
    {"name": "skills_match", "score": 70, "evidence": "...", "missing_keywords": ["..."]},
    {"name": "experience_relevance", "score": 60, "evidence": "...", "missing_keywords": []},
    {"name": "seniority_fit", "score": 80, "evidence": "...", "missing_keywords": []},
    {"name": "education_fit", "score": 90, "evidence": "...", "missing_keywords": []}
  ],
  "matched_keywords": ["..."],
  "missing_keywords": ["..."],
  "suggestions": ["...", "...", "..."],
  "explanation": "<2-3 zdania>"
}
```
W instrukcji wymusić: "Use exactly these 4 category names, in this order" + scoring guide jak w oryginale.

### Krok 4 — `backend/ai.py`: nowy `REVIEW_PROMPT`
Zastąpić blok linii 111-183. Zachować całą "filozofię" (ATS bez żargonu, 6-10s, weak bullets x3, red flags lista, quick wins x3) ale:
- kategorie po `name`: `clarity`, `completeness`, `impact_language`, `ats_friendliness`,
- każda z `score` (0-100), `evidence` (jedno zdanie), `tips` (lista 1-3 konkretnych wskazówek),
- JSON BEZ `overall_score`.
Szkic:
```json
{
  "categories": [
    {"name": "clarity", "score": 80, "evidence": "...", "tips": ["..."]},
    {"name": "completeness", "score": 60, "evidence": "...", "tips": ["..."]},
    {"name": "impact_language", "score": 55, "evidence": "...", "tips": ["..."]},
    {"name": "ats_friendliness", "score": 90, "evidence": "...", "tips": ["..."]}
  ],
  "weak_bullets": [ {"original":"...","reason":"...","rewritten":"..."}, ... x3 ],
  "red_flags": ["..."],
  "quick_wins": ["...","...","..."]
}
```
Zostawić wskazówkę „never use the word ATS in output" (label `ats_friendliness` jest tylko w kluczu JSON, nie w treści dla użytkownika — frontend pokaże label "ATS Friendliness"; to jest OK, bo zakaz dotyczył treści narracyjnej, nie nazwy kategorii. Odnotowane w ryzykach).

### Krok 5 — `backend/ai.py`: post-processing w `analyse_cv()`
Zmodyfikować linie 199-214. Po `data = json.loads(raw)`:
1. Dla każdego elementu `data["categories"]` dołożyć `label` i `weight` z `MATCH_CATEGORIES[name]`.
2. Wyliczyć `overall_score = round(sum(c["score"] * MATCH_CATEGORIES[c["name"]]["weight"] for c in data["categories"]))`.
3. Złożyć `AnalyseResponse(overall_score=..., categories=..., explanation=data["explanation"], missing_keywords=data["missing_keywords"], suggestions=data["suggestions"], matched_keywords=data.get("matched_keywords", []))`.
Szkic helpera (reużywalny dla obu):
```python
def _enrich(categories: list[dict], weights: dict) -> tuple[list[dict], int]:
    for c in categories:
        meta = weights[c["name"]]
        c["label"] = meta["label"]
        c["weight"] = meta["weight"]
    overall = round(sum(c["score"] * weights[c["name"]]["weight"] for c in categories))
    return categories, overall
```
Obsłużyć `KeyError` gdy LLM zwróci nieznaną nazwę kategorii — patrz ryzyka (krok defensywny: pominąć/zmapować, albo rzucić czytelny błąd).

### Krok 6 — `backend/ai.py`: post-processing w `review_cv()`
Zmodyfikować linie 217-226 analogicznie, używając `HEALTH_CATEGORIES`, zwracając `CVHealthResponse(overall_score=..., categories=..., weak_bullets=..., red_flags=..., quick_wins=...)`. Zmienić typ zwracany sygnatury na `CVHealthResponse` (lub alias `ReviewResponse`).

### Krok 7 — `frontend/lib/api.ts`: typy
1. Zastąpić `AnalyseResult` (linie 18-24):
   ```ts
   export interface MatchCategory {
     name: string;
     label: string;
     score: number;
     weight: number;
     evidence: string;
     missing_keywords: string[];
   }
   export interface AnalyseResult {
     overall_score: number;
     categories: MatchCategory[];
     explanation: string;
     missing_keywords: string[];
     suggestions: string[];
     matched_keywords: string[];
   }
   ```
2. Usunąć `SectionScore` (linia 26).
3. Zastąpić `ReviewResult` (linie 28-34) + dodać `HealthCategory`:
   ```ts
   export interface HealthCategory {
     name: string;
     label: string;
     score: number;
     weight: number;
     evidence: string;
     tips: string[];
   }
   export interface ReviewResult {
     overall_score: number;
     categories: HealthCategory[];
     weak_bullets: WeakBullet[];
     red_flags: string[];
     quick_wins: string[];
   }
   ```

### Krok 8 — `frontend/components/CategoryBreakdown.tsx` (NOWY)
Reużywalny dla obu kształtów. Props z dyskryminacją po obecności `tips` vs `missing_keywords`:
```ts
import type { HealthCategory, MatchCategory } from "@/lib/api";
interface Props { categories: (HealthCategory | MatchCategory)[]; }
```
Render per kategoria (inline styles, dark theme spójny z ReviewResult): `label` (uppercase, #666), `score` (duża liczba w kolorze), bar (#222 tło + kolorowy fill `${score}%`), `evidence` (#F5F5F5, 0.8rem), a poniżej:
- jeśli element ma `tips` (Array) → lista tipów (np. z ikoną `Zap` lub myślnikiem),
- jeśli ma `missing_keywords` (Array) → chipy w stylu "missing" (#FF3D00 / #1a0000) jak w analyse/page.
Rozróżnienie w czasie renderu: `"tips" in cat ? ... : "missing_keywords" in cat ? ...`. Uwaga: `MatchCategory` ma `missing_keywords` zawsze (może być []), więc renderować chipy tylko gdy `.length > 0`.
Funkcja koloru lokalna:
```ts
function barColor(s: number) { return s < 50 ? "#FF3D00" : s < 75 ? "#E8FF00" : "#00FF88"; }
```
Trzymać <100 linii (konwencja); jeśli przekracza, wydzielić `CategoryCard` w tym samym pliku lub osobnym.

### Krok 9 — `frontend/components/ReviewResult.tsx`
1. Import `CategoryBreakdown` i typ `ReviewResult` (już jest).
2. Usunąć sekcję B "Section Analysis" (linie 40-63) i zastąpić:
   ```tsx
   <div>
     <p style={headingStyle}>CV Health Categories</p>
     <CategoryBreakdown categories={result.categories} />
   </div>
   ```
3. Reszta (overall score A, weak bullets C, red flags D, quick wins E) bez zmian. `scoreColor` dla overall zostaje.

### Krok 10 — `frontend/app/analyse/page.tsx`
1. Import `CategoryBreakdown`.
2. Linia 152: `<MatchScore score={analyseResult.match_score} />` → `score={analyseResult.overall_score}`.
3. Po bloku score (po linii 153, pod borderem `#E8FF00`) wstawić:
   ```tsx
   <CategoryBreakdown categories={analyseResult.categories} />
   ```
4. Linia 234: `{analyseResult.summary}` → `{analyseResult.explanation}`.
5. Linia 283: `matchScore={analyseResult?.match_score ?? 0}` → `analyseResult?.overall_score ?? 0`.
6. `matched_keywords` (linie 162) i `missing_keywords` (184) — zostają, działają (model je zwraca). Jeśli w kroku 1 zdecydowano usunąć `matched_keywords`, to TU usunąć cały blok "Matched Keywords" (linie 157-178). Domyślnie zachowujemy.

### Krok 11 — weryfikacja
- Backend: uruchomić `uvicorn main:app --reload`, `curl -X POST /analyse/` i `/review/` (przykłady z CLAUDE.md), sprawdzić że JSON zawiera `overall_score`, `categories` z `label`/`weight`, oraz że `overall_score` ≈ średnia ważona.
- Frontend: `npm run build` (TS strict — brak `any`, brak odwołań do usuniętych pól `match_score`/`summary`/`sections`).

## Ryzyka i na co uważać

1. **LLM zwróci nieznaną nazwę kategorii / pominie kategorię.** `_enrich` rzuci `KeyError` lub pominie wagę → overall_score zaniżony. Mitigacja: w post-processingu walidować, że zwrócone `name` ⊆ kluczy słownika, a liczba kategorii == 4; jeśli nie — rzucić czytelny `ValueError` (router zwróci 500 z detalem) zamiast cichego błędu. Prompt musi twardo wymuszać dokładne nazwy i kolejność.
2. **`json.loads` może rzucić** przy malformed output (istniejące ryzyko, nie nowe) — bez zmian, ale teraz dochodzi więcej pól = większa szansa na braki kluczy. Rozważyć `data.get(...)` z domyślnymi `[]` dla list opcjonalnych, ale `categories`/`explanation` muszą być obecne.
3. **`score` jako float vs int.** Modele mają `float` dla per-kategoria score, ale LLM zwykle zwraca int — Pydantic skoaceruje int→float OK. `overall_score` jest `int` po `round()` — OK.
4. **Suma wag musi == 1.0.** Zweryfikowane (health 1.00, match 1.00). Jeśli ktoś zmieni wagi, overall przestanie być w skali 0-100 — dodać komentarz w kodzie przy słownikach.
5. **`overall_score` Field(ge=0, le=100) a round().** Skoro każdy score ∈[0,100] i wagi sumują się do 1, wynik ∈[0,100] — walidacja bezpieczna.
6. **Alias `ReviewResponse = CVHealthResponse`** — upewnić się że `routes/review.py` używa którejkolwiek nazwy spójnie. Sprawdzić import w tym pliku (nie czytany w planie — coder ma zweryfikować jedną linią).
7. **Niespójność progów kolorów**: `CategoryBreakdown` (50/75) vs `ReviewResult.scoreColor` overall (40/70) vs `MatchScore` (50/70). Świadomie zostawione — brief definiuje progi tylko dla CategoryBreakdown. Jeśli user chce pełnej spójności, ujednolicić wszystkie do 50/75 (osobne zadanie).
8. **Zakaz słowa "ATS" w outpucie** dotyczył treści narracyjnej review; label kategorii "ATS Friendliness" pojawia się w UI. To zmiana widoczna dla użytkownika względem starego zachowania — potwierdzić że jest akceptowalna (brief jawnie nazywa kategorię `ats_friendliness`, więc tak).
9. **`matched_keywords`** — rozszerzenie ponad ścisły brief (brief nowego AnalyseResponse go nie wymienia). Zachowane dla UX. Jeśli orchestrator chce 1:1 z briefem — usunąć z modelu, promptu i UI (krok 1 i 10 mają warianty). Wymaga decyzji przed coderem.
10. **`hooks before early returns`** (memory) — nie dotyczy tych komponentów (brak nowych hooków przed returnami), ale `CategoryBreakdown` to czysty render bez hooków — OK.
11. **AGENTS.md frontendu**: "to NIE jest Next.js który znasz" — coder przed pisaniem komponentu powinien zerknąć do `node_modules/next/dist/docs/`. Tu jednak komponent jest czysto prezentacyjny (bez API Next), ryzyko niskie.

## Punkty wymagające decyzji użytkownika przed implementacją
- (A) Czy zachować `matched_keywords` w /analyse (zalecane) czy iść ściśle wg briefu i usunąć?
- (B) Czy ujednolicić progi kolorów w całej apce (ryzyko 7) czy zostawić jak w briefie?

Domyślnie idę: A = zachować, B = zostawić jak w briefie.
