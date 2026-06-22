# Plan: Dwa tryby tailoringu CV (general / targeted)

Nazwa bazowa pipeline: `2026-06-22-ats-tailor`
Raport reviewer/test-writer → `docs/agent-runs/2026-06-22-ats-tailor-raport.md`

## Cel
Dodać dwa tryby auto-tailoringu CV:
- MODE 1 "general" — strona `/review` (tylko CV, brak JD): ATS fixes + wzmocnienie bulletów.
- MODE 2 "targeted" — strona `/analyse` (CV + JD): ATS fixes + wzmocnienie + dopasowanie do oferty.

Bez zmian w istniejącym endpoincie `/tailor/`, funkcji `tailor_cv()` ani w `analyse/page.tsx`.

## Pliki do zmiany/utworzenia
1. `backend/ai.py` — zastąpić `TAILOR_PROMPT`, dodać `TAILOR_GENERAL_PROMPT` + `tailor_cv_general()`.
2. `backend/models.py` — dodać `TailorGeneralRequest`.
3. `backend/routes/tailor.py` — dodać endpoint `POST /tailor/general`.
4. `frontend/lib/api.ts` — dodać `tailorCVGeneral()`.
5. `frontend/components/TailorSection.tsx` — dodać opcjonalny prop `mode`.
6. `frontend/app/review/page.tsx` — dodać `<TailorSection mode="general">` po wynikach.

## Kroki implementacji

### Krok 1 — backend/ai.py
Lokalizacja: linie 42-65 (cała stała `TAILOR_PROMPT`).

a) Zastąpić obecną wartość `TAILOR_PROMPT` dokładnie nową treścią z 3 kategoriami (ATS / readability / job match), ze zmiennymi `__CV__`, `__JD__`, `__MISSING_KEYWORDS__`, `__SUGGESTIONS__` — treść wg promptu z zadania.
b) Dodać nową stałą `TAILOR_GENERAL_PROMPT` (2 kategorie: ATS + readability) ze zmienną tylko `__CV__` — treść wg promptu z zadania.
c) Dodać async funkcję po `tailor_cv()` (po linii 209):
```python
async def tailor_cv_general(cv: str) -> str:
    prompt = TAILOR_GENERAL_PROMPT.replace("__CV__", cv)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
```
Uwaga: `tailor_cv()` (linie 186-209) i jego użycie `TAILOR_PROMPT` (zmienne się zgadzają z nową treścią) pozostają bez zmian — nowy `TAILOR_PROMPT` nadal zawiera te same 4 placeholdery, więc `.replace(...)` w `tailor_cv()` działa.

### Krok 2 — backend/models.py
Dodać nowy model (obok `TailorRequest`):
```python
class TailorGeneralRequest(BaseModel):
    cv: str
```
`TailorResponse` reużywamy bez zmian.

### Krok 3 — backend/routes/tailor.py
Dodać import modelu i nowy endpoint poniżej istniejącego:
```python
from models import TailorRequest, TailorResponse, TailorGeneralRequest

@router.post("/general", response_model=TailorResponse)
async def tailor_general(req: TailorGeneralRequest) -> TailorResponse:
    try:
        tailored = await ai.tailor_cv_general(req.cv)
    except Exception:
        raise HTTPException(status_code=502, detail="AI tailoring failed")
    return TailorResponse(tailored_cv=tailored)
```
Istniejący `POST /tailor/` bez zmian.

### Krok 4 — frontend/lib/api.ts
Dodać obok istniejącej `tailorCV`. Reużyć typ `TailorResult` i istniejący helper `request`:
```typescript
export async function tailorCVGeneral(cv: string): Promise<TailorResult> {
  return request<TailorResult>("/tailor/general", {
    method: "POST",
    body: JSON.stringify({ cv }),
  });
}
```
Coder: sprawdzić dokładną nazwę wewnętrznego helpera (`request`) i czy bazowy URL już zawiera prefix — użyć tej samej konwencji co `tailorCV`.

### Krok 5 — frontend/components/TailorSection.tsx
a) Rozszerzyć interfejs `Props` (linia 8-13) o opcjonalny prop:
```typescript
mode?: "general" | "targeted";
```
b) Destrukturyzacja (linia 15) z domyślną wartością: `mode = "targeted"`.
c) Dodać import: `import { tailorCV, tailorCVGeneral } from "@/lib/api";`
d) W `handleTailor` (linie 21-42):
   - Guard zależny od trybu:
     - general: `if (!cv.trim()) { setError("CV is required."); return; }`
     - targeted: zachować `if (!cv.trim() || !jobDescription.trim())` z dotychczasowym komunikatem.
   - Wywołanie:
     - general: `const result = await tailorCVGeneral(cv);`
     - targeted: dotychczasowe `tailorCV({ cv, job_description, missing_keywords, suggestions })`.
e) Teksty zależne od trybu:
   - Subtext (linia 77-79): general → `"Rewrites your CV for ATS compatibility and stronger bullet points."`; targeted → istniejący tekst.
   - Tekst przycisku w stanie idle (linia 95): general → `"FIX & OPTIMISE CV →"`; targeted → `"Tailor CV →"`. Stan ładowania `"Rewriting your CV…"` zostaje wspólny.

Najprościej: policzyć przed `return` zmienne `const buttonLabel = ...` i `const subtext = ...` na podstawie `mode`. Reguła z memory: żadnych nowych hooków po warunkowym return — tu nie ma warunkowych returnów ani nowych hooków, więc OK.

### Krok 6 — frontend/app/review/page.tsx
Stan CV w tym pliku nazywa się `cv` (linia 11). Wyniki: `result` typu `ReviewResult | null`. Quick wins: `result.quick_wins`.

a) Import: `import TailorSection from "@/components/TailorSection";`
b) Wstawić po linii 80 (po `PdfExportSection`), w tym samym warunku `result !== null`:
```tsx
{result !== null && (
  <TailorSection
    cv={cv}
    mode="general"
    jobDescription=""
    missingKeywords={[]}
    suggestions={result.quick_wins}
  />
)}
```
Warunek `result !== null` gwarantuje brak widoczności przed analizą.

Uwaga: `TailorSection` renderuje wewnątrz własny `<PdfExportSection cvText={tailoredCv}>`. Strona review ma już osobny `PdfExportSection cvText={cv}` (oryginał). To dwie różne sekcje (oryginał vs tailored) — zostawić obie, nie kolidują.

## Ryzyka i na co uważać
- `TailorResult` w api.ts: upewnić się że jest eksportowany/dostępny dla nowej funkcji (jest już używany przez `tailorCV`).
- Nowy `TAILOR_PROMPT` musi zachować wszystkie 4 placeholdery (`__CV__`, `__JD__`, `__MISSING_KEYWORDS__`, `__SUGGESTIONS__`), inaczej `tailor_cv()` zostawi niepodmienione tokeny. Treść z zadania je zawiera — nie modyfikować placeholderów.
- Em dash w promptach (`–`, `—`) i komunikatach — pliki muszą być UTF-8. Na Windows uważać przy zapisie, nie zamieniać na ASCII.
- TypeScript strict, brak `any` — nowy prop jako union literalny, bez `any`.
- Backward compat: `analyse/page.tsx` nie przekazuje `mode` → domyślnie `"targeted"`, zachowanie identyczne. NIE edytować tego pliku.
- Endpoint kolejność w FastAPI: `/general` jako konkretna ścieżka nie koliduje z `/` — bez problemu.
- `result.quick_wins` jako `suggestions` w trybie general nie jest używane przez prompt general (general nie ma `__SUGGESTIONS__`), ale prop jest wymagany przez interfejs — przekazujemy go tylko by spełnić typy; backend i tak go ignoruje. Alternatywnie coder może uczynić `missingKeywords`/`suggestions` opcjonalnymi, ale to zwiększa zakres — zostawić jako wymagane i przekazać `result.quick_wins`/`[]`.
- Frontend AGENTS.md: to nietypowa wersja Next.js — przed pisaniem JSX/importów sprawdzić obowiązujące konwencje w `node_modules/next/dist/docs/` jeśli coś się nie buduje. Weryfikacja: `npm run build` + `npm run lint`.
- Backend weryfikacja: ręczny `curl -X POST http://localhost:8000/tailor/general -H "Content-Type: application/json" -d '{"cv":"..."}'`.
