# Plan refaktoru frontendu — 2026-06-26

## Cel

Bezpieczne czyszczenie frontendu: usunięcie martwego kodu, redukcja powtarzającej się logiki/stylów **w obrębie tego samego pliku** oraz uproszczenie złożonych warunków. Refaktor ma być neutralny dla zachowania i wyglądu — żadnych zmian w JSX, strukturze, stylach renderowanych, ani w API kontraktach. Bez tworzenia nowych plików, bez przenoszenia kodu między plikami, bez dotykania backendu/configów.

## Pliki do zmiany

1. `frontend/components/CVPreview.tsx`
2. `frontend/lib/api.ts`
3. `frontend/app/review/page.tsx`
4. `frontend/app/analyse/page.tsx`

Pliki świadomie POMINIĘTE (uzasadnienie w sekcji Ryzyka): `ReviewResult.tsx`, `CategoryBreakdown.tsx`, `MatchScore.tsx`, `applications/page.tsx`, `components/ui/button.tsx`, skeletony, oba dialogi "replace CV".

---

## Kroki implementacji

### Krok 1 — `frontend/components/CVPreview.tsx`: usuń nieużywany import typu
- **Plik:** `frontend/components/CVPreview.tsx`
- **Co:** Usuń linię 3 `import type { PDFLayout } from "@/lib/api";`.
- **Warunek dla codera:** Przed usunięciem potwierdź (Ctrl+F w pliku) że `PDFLayout` nie pojawia się nigdzie indziej w tym pliku. Z odczytu nagłówka pliku nie jest używany. Jeśli jednak jest używany — NIE usuwaj, zgłoś.
- **Dlaczego:** dead code (nieużywany import).
- **Ryzyko:** Low.

### Krok 2 — `frontend/lib/api.ts`: usuń nieużywany `generatePDF` (warunkowo) — NIE usuwaj `PDFLayout` automatycznie
- **Plik:** `frontend/lib/api.ts`
- **Co:**
  - Najpierw zweryfikuj realne użycie w całym `frontend/`: przeszukaj projekt (grep) na `generatePDF` ORAZ osobno na `PDFLayout`.
  - Jeśli `generatePDF` nie jest wywoływana nigdzie poza definicją — usuń całą funkcję `generatePDF` (od `export async function generatePDF(` do jej zamykającego `}`) wraz z komentarzem-sekcją `// --- PDF Generate ---` jeśli nic innego pod nim nie zostaje.
  - **`PDFLayout` (linia 147):** usuwaj TYLKO jeśli grep potwierdzi zero użyć w całym repo PO usunięciu importu z Kroku 1. Jeśli `PDFLayout` jest używany gdziekolwiek (np. w `CVPreview` przed Krokiem 1, w propsach, w innym komponencie) — zostaw typ.
- **Dlaczego:** dead code (eksport bez konsumenta).
- **Ryzyko:** Medium — funkcja jest `export`, więc martwa tylko jeśli grep po całym `frontend/` (łącznie z `app/` i `components/`) potwierdzi brak importów. Bez potwierdzenia grepem NIE usuwaj.

### Krok 3 — `frontend/app/review/page.tsx`: wyciągnij powtarzający się warunek disabled
- **Plik:** `frontend/app/review/page.tsx`
- **Co:** W komponencie `ReviewPage` wyrażenie `cvText.trim().length < 50` powtarza się 4x (linie 85, 87, 88, 90 — w `disabled` i 3x w `style`). Wprowadź w ciele komponentu, przed `return`, stałą:
  ```ts
  const isDisabled = cvText.trim().length < 50;
  ```
  Następnie podmień wszystkie 4 wystąpienia `cvText.trim().length < 50` na `isDisabled`. Atrybut `disabled` pozostaje `disabled={isDisabled || loading}`.
- **Uwaga:** stała musi być policzona przy każdym renderze (zwykły `const` w ciele komponentu — bez `useMemo`, wartość trywialna). Nie owijać w hook.
- **Dlaczego:** complexity / duplikacja wyrażenia w jednym pliku.
- **Ryzyko:** Low. Zachowanie identyczne — to ta sama wartość boolean.

### Krok 4 — `frontend/app/analyse/page.tsx`: wyciągnij powtarzający się warunek "puste pola"
- **Plik:** `frontend/app/analyse/page.tsx`
- **Co:** Wyrażenie `!(cvText.trim().length > 0 && jobDescription.trim().length > 0)` powtarza się 4x (linie 134, 137, 138, 139). Wprowadź w ciele `AnalysePage`, przed `return`, stałą:
  ```ts
  const isDisabled = !(cvText.trim().length > 0 && jobDescription.trim().length > 0);
  ```
  Podmień wszystkie 4 wystąpienia na `isDisabled`. Atrybut `disabled` pozostaje `disabled={loading || isDisabled}`.
- **Uwaga:** zwykły `const` w ciele komponentu, bez `useMemo`.
- **Dlaczego:** complexity / duplikacja w jednym pliku.
- **Ryzyko:** Low.

### Krok 5 — `frontend/app/analyse/page.tsx`: wyciągnij powtarzający się styl nagłówka sekcji
- **Plik:** `frontend/app/analyse/page.tsx`
- **Co:** Wzorzec `className="uppercase tracking-widest font-medium mb-3"` (lub `mb-4`) ze `style={{ fontSize: "0.65rem", color: "#666666" }}` powtarza się dla nagłówków sekcji: "Matched Keywords" (164), "Missing Keywords" (186), "Suggestions" (211), "Summary" (239).
  - Wspólna jest TYLKO część `style`: `{ fontSize: "0.65rem", color: "#666666" }`. Wartości `mb-3`/`mb-4` w `className` różnią się — ich NIE ujednolicaj.
  - Wprowadź na górze pliku (obok istniejącego `inputStyle`, ten sam wzorzec modułowej stałej) stałą:
    ```ts
    const sectionHeadingStyle: React.CSSProperties = { fontSize: "0.65rem", color: "#666666" };
    ```
  - Podmień 4 wystąpienia inline `style={{ fontSize: "0.65rem", color: "#666666" }}` na `style={sectionHeadingStyle}` POZOSTAWIAJĄC `className` bez zmian (z różnym `mb-3`/`mb-4`).
- **Uwaga / decyzja:** Linie 59 (heading "AI Analysis") i 103/114 (labelki "Your CV"/"Job Description") używają podobnego `fontSize: "0.65rem"`, ale z INNYM `color` (`#666666` vs `#F5F5F5`) lub innym kontekstem. NIE podmieniaj ich na `sectionHeadingStyle` — to nie ten sam styl. Podmieniamy wyłącznie 4 nagłówki sekcji o kolorze `#666666` w bloku wyników (linie 164, 186, 211, 239).
- **Dlaczego:** duplikacja stałej stylu (4x) w jednym pliku.
- **Ryzyko:** Medium — łatwo przez pomyłkę podmienić też element o innym kolorze i zmienić wygląd. Coder musi porównać każde wystąpienie literalnie i podmieniać tylko dokładnie `{ fontSize: "0.65rem", color: "#666666" }`.

---

## Świadomie pominięte (nie wchodzą do tego refaktoru)

- **scoreColor / barColor / inline kolory progów** — duplikat jest między RÓŻNYMI plikami. Reguły codera zakazują nowych wspólnych utility i przenoszenia między plikami, więc nie da się tego skonsolidować bez łamania reguł. Dodatkowo `ScoreChip` w `applications/page.tsx` używa INNYCH progów (`>= 70 / >= 50`) niż reszta (`< 50 / < 75`) — ujednolicenie zmieniłoby zachowanie. Pomijamy w całości.
- **Dialog "replace CV"** (`review/page.tsx` + `analyse/page.tsx`) — identyczny JSX w dwóch plikach; ekstrakcja wymagałaby nowego komponentu (zakaz). Skip.
- **Helper `const S` w skeletonach** — wspólny między plikami; przeniesienie zakazane. Skip.
- **`headingStyle` w `ReviewResult.tsx`** — używany 5x, ale JEST już wyciągnięty jako stała modułowa w tym pliku (linia 18). Nic do roboty.
- **`components/ui/button.tsx`** — używany przez `dialog.tsx`; explorer wprost: zostaw.
- **`CVPreview.tsx` (logika generowania HTML)** — out of scope poza Krokiem 1; ryzyko Medium, brak realnej wartości w refaktorze samej logiki PDF. Skip.

---

## Ryzyka i na co uważać

- **Krok 2 (Medium):** `generatePDF` i `PDFLayout` są `export`. Usunięcie BEZ grepa po całym `frontend/` grozi złamaniem buildu, jeśli istnieje konsument poza zbadanymi plikami. Coder MUSI zweryfikować grepem oba symbole przed usunięciem; brak potwierdzenia = nie usuwa, zgłasza.
- **Krok 5 (Medium):** ryzyko przypadkowej podmiany elementu o innym kolorze/kontekście → wizualna regresja. Podmieniać tylko literalnie identyczne `{ fontSize: "0.65rem", color: "#666666" }` przy 4 nagłówkach sekcji wyników.
- **Hooki przed early-return (auto memory):** wprowadzane stałe `isDisabled` i `sectionHeadingStyle` to zwykłe `const`, NIE hooki — nie podlegają regule kolejności hooków, ale i tak umieścić je na górze ciała komponentu / w zakresie modułu (styl jako stała modułowa, spójnie z istniejącym `inputStyle`).
- **AGENTS.md frontendu:** plik `frontend/AGENTS.md` ostrzega, że to nietypowa wersja Next.js — dotyczy to PISANIA kodu (coder). Dla tego refaktoru nie dodajemy nowych API Next.js, więc nie ma wpływu na zakres, ale coder powinien być świadomy przy ewentualnych wątpliwościach.
- **Weryfikacja końcowa:** po zmianach uruchomić `npm run build` (TypeScript strict) i `npm run lint` z `frontend/`. Build musi przejść — szczególnie po usunięciach z Kroku 2.
- **Bez zmian zachowania:** wszystkie kroki to czysta ekstrakcja stałych i usunięcie martwego kodu. Jeśli coder zauważy, że jakaś podmiana zmienia wynik renderowania — zatrzymać się i zgłosić.

---

Nazwa bazowa raportu dla kolejnych agentów: `2026-06-26-frontend-refactor` → reviewer/test-writer piszą do `docs/agent-runs/2026-06-26-frontend-refactor-raport.md`.
