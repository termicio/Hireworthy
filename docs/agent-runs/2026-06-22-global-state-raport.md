# Review: global state (cv-context) — 2026-06-22

Pliki: `lib/cv-context.tsx`, `app/layout.tsx`, `app/review/page.tsx`, `app/analyse/page.tsx`

---

## Krytyczne (blokują działanie)

Brak.

---

## Poważne (zepsują UX lub typy)

### 1. `app/review/page.tsx` — `handleCvChange` nie aktualizuje `cvText` gdy `pendingCvText !== null`

Użytkownik wpisuje nowy tekst CV przy istniejących wynikach. `handleCvChange` ustawia `pendingCvText`, ale `CvInput` nadal pokazuje stary `cvText` (z contextu). Gdy użytkownik potwierdzi ("YES"), `setCvText(pendingCvText)` użyje ostatniej wartości `pendingCvText` — to jest poprawne. Jednak `CvInput` nie pokazuje żywego podglądu wpisywanego tekstu, bo jego `value={cvText}` nie zmienia się. Zależy od zamierzonego UX, ale jeśli `CvInput` jest widoczny tylko gdy `reviewResult === null` (linia 82), to faktycznie ten branch nigdy nie jest widoczny jednocześnie z aktywnym `pendingCvText`. Problem nie blokuje działania — zachowanie jest logicznie spójne — ale warto zweryfikować czy intent był inny.

**Werdykt:** nie blokuje, opisuję dla jasności.

### 2. `app/analyse/page.tsx` — `TailorSection` bez `mode` prop przy braku `jobDescription`

W `analyse/page.tsx` linia 266, `TailorSection` nie przekazuje `mode`. Domyślna wartość w komponencie to `"targeted"` (linia 16 `TailorSection.tsx`), co jest poprawne dla strony analizy. Brak problemu.

---

## Drobne

Brak istotnych drobnych problemów poza opisanymi niżej potwierdzeniami.

---

## OK

Wszystkie sprawdzane punkty z listy zadań:

### lib/cv-context.tsx
- `useCVContext()` rzuca `Error("useCVContext must be used within CVProvider")` gdy kontekst jest `null` — OK (linia 50).
- Typy `ReviewResult` i `AnalyseResult` importowane z `@/lib/api` przez `import type` — OK (linia 4).
- Brak `any` — OK. Wszystkie pola mają jawne typy.

### app/layout.tsx
- `CVProvider` owija bezpośrednio `<Sidebar />` i `<main>` bez dodatkowego wrappera DOM — OK (linia 29-32). Flex layout `body` nie jest przerwany.
- Import z `@/lib/cv-context` — OK (linia 6).

### app/review/page.tsx
- Hooki (`useCVContext`, `useState` x3) są na liniach 12-15, przed jakimkolwiek `return` — OK.
- `pendingCvText` to lokalny `useState<string | null>` (linia 15), nie z contextu — OK.
- `PdfExportSection` nieobecny w importach ani JSX — OK.
- Dwukolumnowy grid: `lg:grid-cols-5` z `lg:col-span-3` / `lg:col-span-2` — OK (linia 120-126).
- Prawa kolumna ma `position: sticky` i `alignSelf: start` (linia 126) — OK.
- `handleCvChange` (linie 30-36): gdy `reviewResult !== null` ustawia `pendingCvText`, w przeciwnym razie `setCvText` — OK.

### app/analyse/page.tsx
- Hooki (`useCVContext`, `useState` x5) są na liniach 27-32, przed jakimkolwiek `return` — OK.
- Używa `cvText`, `jobDescription`, `analyseResult` z contextu — OK. Brak starych nazw `cv`/`jd`/`result`.
- `TailorSection` jest w prawej kolumnie (`lg:col-span-2`, linia 251-272) — OK.
- `SaveApplicationModal` używa `analyseResult?.match_score ?? 0` (linia 277) — OK.
- `CvInput` ma `onChange={handleCvChange}` (linia 99) — OK.
- Nieużywane importy: brak. Wszystkie zaimportowane symbole (`analyseCV`, `MatchScore`, `SaveApplicationModal`, `CvInput`, `TailorSection`, `Loader2`, `CheckCircle2`, `useCVContext`) są używane — OK.
