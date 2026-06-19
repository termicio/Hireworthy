# Plan: Pivot Job Tracker → CV Review & Tailoring Platform

Data: 2026-06-19
Nazwa bazowa pipeline: `2026-06-19-cv-review-platform`
(reviewer i test-writer piszą do `docs/agent-runs/2026-06-19-cv-review-platform-raport.md`)

## Cel

Dodać nową, samodzielną funkcję "CV Review" (szczery, krytyczny audyt CV przez AI bez kontekstu ogłoszenia) oraz przebudować nawigację i stronę startową, tak aby aplikacja prezentowała się jako platforma do recenzji i dopasowywania CV, a nie wyłącznie tracker aplikacji.

Zakres obejmuje:
- nowy endpoint backendu `POST /review/`,
- nowe modele Pydantic i prompt AI,
- nowy typ + funkcję w `lib/api.ts`,
- nową stronę `/review` z komponentem prezentującym wyniki,
- nową landing page zamiast redirectu,
- przebudowę sidebara (kolejność + wyróżnienie "Review CV").

## Pliki do zmiany/utworzenia

Backend:
1. `backend/models.py` — ZMIANA (dodać 4 modele)
2. `backend/ai.py` — ZMIANA (dodać `REVIEW_PROMPT` + `review_cv`)
3. `backend/routes/review.py` — NOWY
4. `backend/main.py` — ZMIANA (rejestracja routera)

Frontend:
5. `frontend/lib/api.ts` — ZMIANA (typy + `reviewCV`)
6. `frontend/components/ReviewResult.tsx` — NOWY (render wyników)
7. `frontend/app/review/page.tsx` — NOWY (strona)
8. `frontend/app/page.tsx` — ZMIANA (landing zamiast redirect)
9. `frontend/components/Sidebar.tsx` — ZMIANA (nawigacja)

## Kroki implementacji

### Krok 1 — `backend/models.py`: nowe modele
Dodać (zachowując istniejący styl Pydantic w pliku):
```python
class SectionScore(BaseModel):
    name: str
    score: int  # 0-100

    comment: str

class WeakBullet(BaseModel):
    original: str
    reason: str
    rewritten: str

class ReviewRequest(BaseModel):
    cv: str

class ReviewResponse(BaseModel):
    overall_score: int  # 0-100
    sections: list[SectionScore]
    weak_bullets: list[WeakBullet]
    red_flags: list[str]
    quick_wins: list[str]
```
Zakres: tylko dodanie modeli. Nie zmieniać istniejących. Użyć tej samej składni importów/BaseModel co reszta pliku.

### Krok 2 — `backend/ai.py`: prompt + funkcja
Wzorować się 1:1 na `analyse_cv` (kontrakt JSON, `_strip_fences`, `json.loads`, `model="claude-sonnet-4-6"`).

2a. Zaktualizować import:
`from models import AnalyseResponse, ReviewResponse`

2b. Dodać `REVIEW_PROMPT` (placeholder `__CV__`, podstawiane przez `.replace`). Wymagania promptu:
- rola: bezwzględnie szczery, krytyczny recruiter/CV reviewer — NIE zachęcający, NIE łagodzący.
- ocenia dokładnie sekcje o nazwach: `Contact Info`, `Summary/Objective`, `Experience`, `Skills`, `Education` (wymienić je jawnie, żeby `sections` było przewidywalne i stałe — 5 pozycji).
- `weak_bullets`: wybrać dokładnie 3 najsłabsze bullet pointy; dla każdego `original` (cytat z CV), `reason` (czemu słaby), `rewritten` (mocniejsza wersja, bez wymyślania faktów).
- `red_flags`: lista konkretnych problemów (luki w datach, brak liczb, ogólniki, literówki itp.); może być pusta.
- `quick_wins`: dokładnie 3 najszybsze poprawki o największym efekcie.
- Klauzula JSON identyczna w duchu jak w `ANALYSIS_PROMPT`: "Respond ONLY with a valid JSON object — no preamble, no markdown, no backticks." + jawna struktura JSON odpowiadająca `ReviewResponse` (overall_score int 0-100, sections[{name,score,comment}], weak_bullets[{original,reason,rewritten}], red_flags[str], quick_wins[str]).

2c. Dodać funkcję:
```python
async def review_cv(cv: str) -> ReviewResponse:
    prompt = REVIEW_PROMPT.replace("__CV__", cv)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = _strip_fences(response.content[0].text)
    data = json.loads(raw)
    return ReviewResponse(**data)
```
Uwaga: `max_tokens` >= 2500 (odpowiedź jest duża: 5 sekcji + 3 bullety z rewrite + listy).

### Krok 3 — `backend/routes/review.py`: nowy router
Skopiować wzorzec z `routes/analyse.py`:
```python
from fastapi import APIRouter, HTTPException
from models import ReviewRequest, ReviewResponse
from ai import review_cv

router = APIRouter()

@router.post("/", response_model=ReviewResponse)
async def review(request: ReviewRequest):
    if len(request.cv.strip()) < 50:
        raise HTTPException(status_code=400, detail="CV is too short.")
    try:
        return await review_cv(request.cv)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Review failed: {str(e)}")
```
Endpoint to `POST /` w routerze (prefix `/review` dodaje main.py) → finalnie `POST /review/`.

### Krok 4 — `backend/main.py`: rejestracja
Wzorować się na rejestracji routera `analyse`. Dodać import `from routes import review` (lub analogicznie do istniejących importów) oraz `app.include_router(review.router, prefix="/review", tags=["review"])` z tym samym stylem co pozostałe routery. NIE ruszać lifespan/CORS.

### Krok 5 — `frontend/lib/api.ts`: typy + funkcja
Dodać typy:
```ts
export interface SectionScore { name: string; score: number; comment: string; }
export interface WeakBullet { original: string; reason: string; rewritten: string; }
export interface ReviewResult {
  overall_score: number;
  sections: SectionScore[];
  weak_bullets: WeakBullet[];
  red_flags: string[];
  quick_wins: string[];
}
```
Dodać funkcję (użyć istniejącego helpera `request<T>`):
```ts
export async function reviewCV(cv: string): Promise<ReviewResult> {
  return request<ReviewResult>("/review/", {
    method: "POST",
    body: JSON.stringify({ cv }),
  });
}
```
Zachować konwencję: zero bezpośredniego `fetch`, wszystko przez `request`.

### Krok 6 — `frontend/components/ReviewResult.tsx`: render wyników
`"use client"` nie jest konieczne (czysto prezentacyjny, bez hooków) — pominąć, jeśli komponent nie używa stanu. Props: `{ result: ReviewResult }`.
Helper koloru (lokalna funkcja w pliku, NIE w api.ts):
```ts
function scoreColor(score: number): string {
  if (score < 40) return "#FF3D00";
  if (score < 70) return "#E8FF00";
  return "#00FF88";
}
```
Sekcje (kolejność A→E):
- A Overall Score: duża liczba 0-100 + pasek o szerokości `score%` w kolorze `scoreColor`.
- B Section Analysis: grid `grid-cols-1 md:grid-cols-2`, każda karta: `bg #111111`, border `#222222`, nazwa sekcji, pasek koloru, jednolinijkowy `comment`.
- C Bullet Point Analysis: lista `weak_bullets`. Każdy element z labelami "ORIGINAL", "WHY IT'S WEAK", "REWRITTEN" (rewritten w kolorze accent `#E8FF00`). Labele małe, muted `#666666`, mono.
- D Red Flags: każdy element z ikoną `AlertTriangle` (lucide-react), kolor `#FF3D00`. Jeśli `red_flags` puste — nie renderować sekcji.
- E Quick Wins: numerowana lista 1..n, ikona `Zap` (lucide-react), accent `#E8FF00`.
Kolory dynamiczne przez inline `style`, layout przez Tailwind (zgodnie z konwencją). Komponent może przekroczyć ~100 linii — to akceptowalne dla dedykowanego komponentu wyników (analogicznie do istniejących). Jeśli wyjdzie bardzo długi, można wydzielić pod-komponenty per sekcja w tym samym pliku lub osobnych — decyzja codera, ale priorytet: czytelność i limit konwencji.

### Krok 7 — `frontend/app/review/page.tsx`: strona
`"use client"`. Stany: `cv: string`, `loading: boolean`, `error: string | null`, `result: ReviewResult | null`.
WAŻNE (auto-memory): wszystkie hooki (useState/useMemo/useCallback) MUSZĄ być przed jakimkolwiek warunkowym `return`.
Układ:
1. Nagłówek "REVIEW MY CV" + podtytuł "Get an honest AI assessment of your CV".
2. `<CvInput value={cv} onChange={setCv} />` (reuse — props `{ value, onChange }`).
3. Przycisk "ANALYSE CV →" (primary, bg `#E8FF00`, czarny tekst), `disabled` gdy `cv.trim().length < 50 || loading`.
4. Handler: ustaw `loading=true`, `error=null`, w `try` `setResult(await reviewCV(cv))`, w `catch` `setError(...)` + `console.error`, w `finally` `loading=false`.
5. Loading: gdy `loading` — komunikat "Analysing your CV..." + `Loader2` z animacją spin (`animate-spin`). Bez skeletonu.
6. Error: czerwony komunikat (`#FF3D00`).
7. Gdy `result !== null` → `<ReviewResult result={result} />`.
Trzymać stronę poniżej ~100 linii (logika UI + delegacja do ReviewResult).

### Krok 8 — `frontend/app/page.tsx`: landing page
USUNĄĆ `redirect("/dashboard")` w całości (nie mieszać redirect + JSX). Strona może być Server Component (Link z `next/link` działa, brak hooków). Układ:
- sekcja full-height, wycentrowana (`min-h-screen flex flex-col items-center justify-center`).
- Headline "KNOW EXACTLY WHERE YOUR CV STANDS" — font-display, bold, ~3-4rem.
- Subheadline "AI-powered CV review and job match analysis" — kolor muted `#666666`.
- Dwa CTA obok siebie (`<Link>`):
  - Primary "Review my CV →" → `/review`, bg `#E8FF00`, czarny tekst.
  - Secondary "Match to a job →" → `/analyse`, border `#E8FF00`, tło transparentne, tekst `#E8FF00`.

### Krok 9 — `frontend/components/Sidebar.tsx`: nawigacja
Zmienić tablicę `links` na (w tej kolejności), dobierając ikony z lucide-react:
1. `{ href: "/review", label: "Review CV", icon: <np. FileSearch / ScanText> }`
2. `{ href: "/analyse", label: "Match to Job", icon: <np. Target / ScanText> }`
3. `{ href: "/applications", label: "Applications", icon: BriefcaseBusiness }`
4. `{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }`
Usunąć stary wpis "Analyse" (zastąpiony przez "Match to Job" → `/analyse`).
Wyróżnienie "Review CV" jako PRIMARY: ma mieć kolor `#E8FF00` ZAWSZE (nie tylko gdy active) + pogrubienie/większy tekst. Zrealizować przez flagę na elemencie linku, np. `primary?: boolean` na pierwszym wpisie, i w mapowaniu: jeśli `primary` i NIE active → wymusić klasę `text-[#E8FF00]` zamiast `text-[#666666]`; jeśli active → zostaje istniejące active styling. NIE zmieniać logiki `active = pathname.startsWith(href)` ani inline `borderLeft` dla pozostałych tras.
Uwaga na import ikon — dodać nowe nazwy ikon do importu z `lucide-react`, usunąć nieużywane (`ScanText` jeśli nie wykorzystywane).

## Ryzyka i na co uważać

1. **Strict JSON z AI**: `REVIEW_PROMPT` musi wymusić czysty JSON (bez fences, bez preambuły). Każde odstępstwo wywala `json.loads`. Trzymać klauzulę identyczną w stylu jak `ANALYSIS_PROMPT`. `_strip_fences` łapie tylko fences, nie preambułę.
2. **max_tokens**: odpowiedź duża — ustawić >= 2500. Za mała wartość obetnie JSON i `json.loads` rzuci wyjątek → 500.
3. **Liczność sekcji/bulletów**: model może zwrócić inną liczbę niż 5 sekcji / 3 bullety. Frontend MUSI renderować dynamicznie po długości tablic (`.map`), nie zakładać sztywno 5/3. Prompt prosi o stałą liczbę, ale UI nie może się wywalić przy odstępstwie.
4. **page.tsx**: pełna wymiana — żadnego pozostawionego `redirect` ani importu `next/navigation` `redirect`.
5. **Sidebar inline styling**: zachować inline `borderLeft` i klasy active dla istniejących tras; nie psuć wyróżnienia. Przetestować, że "Review CV" świeci na żółto także na innych podstronach.
6. **Hooks before returns** (auto-memory): w `review/page.tsx` żaden hook po warunkowym return.
7. **Konwencje**: brak `any`, brak `console.log` (tylko `console.error` w catch), wszystkie wywołania API przez `lib/api.ts`, ikony tylko z `lucide-react`, kolory dynamiczne inline.
8. **Walidacja długości CV po obu stronach**: front (`disabled` < 50) i back (HTTPException 400 < 50) — spójne, żeby user dostał czytelny komunikat zanim trafi w 400.
9. **Next.js wersja nietypowa** (`frontend/AGENTS.md`): coder przed pisaniem komponentów powinien zerknąć do `node_modules/next/dist/docs/` na wypadek zmian w App Router. Funkcjonalność "instant navigation" (`unstable_instant`) NIE jest wymagana w tym zadaniu — nie wprowadzać jej. Jest tylko hintem dla problemów z wolną nawigacją, których tu nie rozwiązujemy.
10. **Nazwy ikon lucide-react**: zweryfikować istnienie wybranych ikon (`FileSearch`, `Target`, `Zap`, `AlertTriangle`, `Loader2`) w zainstalowanej wersji przed użyciem.

## Następne kroki w pipeline
Po akceptacji planu: coder implementuje wg kroków 1-9 (kolejność backend → api → komponenty → strony → sidebar). Następnie reviewer i test-writer dopisują do `docs/agent-runs/2026-06-19-cv-review-platform-raport.md`.
