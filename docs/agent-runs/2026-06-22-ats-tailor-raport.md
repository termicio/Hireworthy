# Raport reviewera — 2026-06-22-ats-tailor

## Krytyczne (blokują działanie)

Brak.

---

## Poważne (zepsują UX lub typy)

### 1. `tailor_general` w `routes/tailor.py` — błąd HTTP 500 zamiast 502

`tailor_general` podnosi `HTTPException(status_code=500, detail=str(e))`, podczas gdy analogiczny endpoint `tailor` używa `502`. Mniejszy problem, ale `str(e)` wystawia surowy komunikat wyjątku (może zawierać ścieżki, klucze SDK, wewnętrzne detale) bezpośrednio w odpowiedzi klienta. Należy albo ujednolicić kody błędów, albo użyć stałego komunikatu jak w `/`.

### 2. `review/page.tsx` — `suggestions` przekazane jako `quick_wins`, nie `suggestions`

`TailorSection` w trybie `general` ignoruje prop `suggestions` (nie wysyła ich do backendu — `tailorCVGeneral` przyjmuje tylko `cv`). Przekazanie `result.quick_wins` do `suggestions` jest bezcelowe i może wprowadzać w błąd osoby czytające kod, sugerując że quick_wins mają wpływ na wynik tailoringu. Wartość powinna być `[]` lub prop powinien zostać usunięty z wywołania w trybie general.

---

## Drobne

### 3. `backend/ai.py` — brak importu `TailorGeneralRequest` nie istnieje w `ai.py` (nie jest potrzebny)

Bez uwag — `ai.py` importuje tylko to czego używa (`AnalyseResponse`, `ReviewResponse`). Poprawne.

### 4. `frontend/lib/api.ts` — `TailorResult` nie jest eksportowany jako `type`

`TailorResult` jest zdefiniowany jako `interface` ale nie ma eksportu `type TailorResult`. W strict TypeScript z `isolatedModules` to nie jest problem, ale eksport z `export type` byłby spójniejszy z resztą typów (np. `ReviewResult`).

### 5. `TailorSection.tsx` — inline `React.CSSProperties` na poziomie komponentu, nie w render

`scrollableText` jest definiowany w ciele komponentu przy każdym renderze, poza `useMemo`. Przy tej liczbie renderów to bez znaczenia, ale warto wynieść jako stałą poza funkcję.

---

## OK

- `backend/ai.py`: `tailor_cv_general()` zwraca `str`, sygnatura poprawna. `TAILOR_GENERAL_PROMPT` zawiera placeholder `__CV__`. `TAILOR_PROMPT` zawiera wszystkie 4 placeholdery: `__CV__`, `__JD__`, `__MISSING_KEYWORDS__`, `__SUGGESTIONS__`. Wszystkie wywołania Claude są `async`.
- `backend/models.py`: `TailorGeneralRequest` to poprawny model Pydantic z polem `cv: str`. `TailorResponse` z polem `tailored_cv: str` pokrywa oba endpointy.
- `backend/routes/tailor.py`: endpoint `POST /` jest nienaruszony. Endpoint `POST /general` istnieje, importuje `TailorGeneralRequest` i `ai.tailor_cv_general`.
- `frontend/lib/api.ts`: `tailorCVGeneral` zwraca `Promise<TailorResult>`, URL to `/tailor/general`, body to `{ cv }`. Poprawne.
- `frontend/components/TailorSection.tsx`: prop `mode` jest opcjonalny z defaultem `"targeted"`. Wszystkie hooki (`useState` x4) są przed jakimkolwiek warunkowym return — brak naruszenia reguły hooków. Logika `general`/`targeted` w `handleTailor` jest poprawna. `tailorCVGeneral` jest importowany.
- `frontend/app/review/page.tsx`: `TailorSection` jest importowany. Używany z `mode="general"`. Renderowany wyłącznie gdy `result !== null`.
