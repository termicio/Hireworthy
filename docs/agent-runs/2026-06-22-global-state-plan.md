# Plan: Global CV Context + Two-Column Results Layout

Nazwa bazowa pipeline: `2026-06-22-global-state`
Raport kolejnych agentów: `docs/agent-runs/2026-06-22-global-state-raport.md`

## Cel

1. Wprowadzić globalny React Context (`CVProvider` / `useCVContext`, in-memory) trzymający współdzielony stan CV: `cvText`, `jobDescription`, `reviewResult`, `analyseResult`, oraz `clearAll()`. Dzięki temu CV i wyniki persystują między `/review` a `/analyse` przy nawigacji klient-side (bez przeładowania strony).
2. Zmigrować `review/page.tsx` i `analyse/page.tsx` z lokalnego `useState` na context (cv/jd/wyniki), zachowując lokalnie efemeryczne stany UI (`loading`, `error`, `showModal`, `saved`, `pendingCvText`).
3. Dodać UX guardy: banner "Showing previous results" + inline confirm przy próbie zmiany CV gdy istnieją wyniki (BEZ `window.confirm`, stan `pendingCvText` lokalny).
4. Po otrzymaniu wyników przejść na układ dwukolumnowy (wyniki po lewej `lg:col-span-3`, sticky panel po prawej `lg:col-span-2`) na obu stronach, z preview snippet CV + `TailorSection` w prawej kolumnie.

## Pliki do zmiany/utworzenia (w kolejności)

1. `frontend/lib/cv-context.tsx` — NOWY
2. `frontend/app/layout.tsx` — dodać `<CVProvider>`
3. `frontend/app/review/page.tsx` — migracja stanu + layout + usunięcie `PdfExportSection`
4. `frontend/app/analyse/page.tsx` — migracja stanu + layout (przeniesienie `TailorSection` do prawej kolumny)

NIE zmieniać: backend, `CvInput`, `CVPreview`, `HeatmapGrid`, `TailorSection`, `PdfExportSection`, `ReviewResult`.

Kolory: `#080808`, `#111111`, `#222222`, `#E8FF00`, `#F5F5F5`, `#666666`.

> Weryfikacja Next.js: standardowy wzorzec Context Provider w pliku `"use client"`, importowany do Server Component `layout.tsx`, jest w tej wersji Next.js w pełni wspierany (sprawdzone w `node_modules/next/dist/docs/`). Granica RSC/Client tworzona automatycznie na imporcie — `layout.tsx` zostaje Server Component.

---

## Krok 1 — `frontend/lib/cv-context.tsx` (NOWY plik)

### Zakres
Client-side Context z providerem i hookiem.

### Zawartość (szkic)
- `"use client"` — PIERWSZA linia.
- Import typów: `import type { ReviewResult, AnalyseResult } from "@/lib/api";`
  (Potwierdzone: `ReviewResult` eksportowany z `@/lib/api` — `review/page.tsx` importuje `type ReviewResult` stamtąd. `AnalyseResult` analogicznie; coder potwierdza eksport w `lib/api.ts`, jeśli go brak — dodać eksport, bez zmiany kształtu typu.)
- Interfejs:
  ```typescript
  interface CVState {
    cvText: string;
    setCvText: (text: string) => void;
    jobDescription: string;
    setJobDescription: (text: string) => void;
    reviewResult: ReviewResult | null;
    setReviewResult: (r: ReviewResult | null) => void;
    analyseResult: AnalyseResult | null;
    setAnalyseResult: (r: AnalyseResult | null) => void;
    clearAll: () => void;
  }
  ```
- `const CVContext = createContext<CVState | null>(null);`
- `CVProvider({ children }: { children: React.ReactNode })`:
  - `useState` dla: `cvText` (""), `jobDescription` (""), `reviewResult` (null), `analyseResult` (null).
  - `clearAll` = `useCallback` resetujące WSZYSTKIE 4 pola do wartości początkowych.
  - `value` — zalecany `useMemo` (zależności: 4 stany + `clearAll`), żeby unikać zbędnych re-renderów konsumentów. Brak early returnu, więc reguła hooków zachowana.
  - Zwraca `<CVContext.Provider value={...}>{children}</CVContext.Provider>` — BEZ dodatkowego `<div>` (żeby nie zepsuć flex layoutu body).
- `useCVContext()`:
  ```typescript
  export function useCVContext(): CVState {
    const ctx = useContext(CVContext);
    if (ctx === null) throw new Error("useCVContext must be used within a CVProvider");
    return ctx;
  }
  ```

### Edge case'y
- Hook rzuca jasny Error poza providerem — wymaganie spełnione.
- In-memory only: zero `localStorage`/`sessionStorage`. Pełny reload czyści stan — oczekiwane.

---

## Krok 2 — `frontend/app/layout.tsx`

### Zmiany
- Dodać `import { CVProvider } from "@/lib/cv-context";`
- Owinąć Sidebar + main w `<CVProvider>` (Provider bez własnego DOM-wrappera, więc flex layout zostaje):
  ```jsx
  <body className="flex min-h-screen bg-background text-foreground antialiased">
    <CVProvider>
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto min-h-screen" style={{ marginLeft: "56px" }}>
        {children}
      </main>
    </CVProvider>
  </body>
  ```
- NIE dodawać `"use client"` do layoutu. Nie zmieniać `metadata` ani fontów.

---

## Krok 3 — `frontend/app/review/page.tsx`

### Stan: usunąć / dodać
- USUNĄĆ lokalny `useState`: `cv` (linia 12), `result` (linia 15).
- ZACHOWAĆ lokalny: `loading`, `error`.
- DODAĆ z contextu (hook NA GÓRZE, przed jakimkolwiek return/ternary):
  `const { cvText, setCvText, reviewResult, setReviewResult, clearAll } = useCVContext();`
- DODAĆ lokalny: `const [pendingCvText, setPendingCvText] = useState<string | null>(null);`

### Importy
- DODAĆ `import { useCVContext } from "@/lib/cv-context";`
- USUNĄĆ import i użycie `PdfExportSection` (linie 7 i 81) — TailorSection renderuje go wewnętrznie po tailoringu.
- `type ReviewResult` import: po migracji typ nie jest już jawnie używany w pliku (stan zniknął) → usunąć z importu (inaczej ESLint zgłosi nieużywany import). `reviewCV` zostaje.

### Logika
- `cv` → `cvText`, `result` → `reviewResult` w całym JSX i handlerach.
- `handleAnalyse`: `setReviewResult(await reviewCV(cvText));`
- Handler zmiany CV (przekazany do `CvInput onChange`):
  ```tsx
  function handleCvChange(next: string) {
    if (reviewResult !== null) setPendingCvText(next);   // nie nadpisuj — pokaż confirm
    else setCvText(next);
  }
  ```
  `<CvInput value={cvText} onChange={handleCvChange} />`
- Inline confirm (gdy `pendingCvText !== null`):
  - Tekst: "You have existing results. Replace CV and run new analysis?"
  - YES → `clearAll(); setCvText(pendingCvText); setPendingCvText(null);` (kolejność: clearAll resetuje cvText do "", potem ustawiamy pendingCvText)
  - NO → `setPendingCvText(null);`
  - Styl: YES akcent (`#E8FF00` tło / `#080808` tekst), NO outline (`1px solid #222222`, tekst `#666666`). Brak `window.confirm`.

### Struktura JSX (szkic)
```jsx
return reviewResult === null ? (
  /* TRYB FORMULARZA — obecny układ, maxWidth 760px centrowany */
  <div style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
    {/* nagłówek (bez zmian) */}
    <CvInput value={cvText} onChange={handleCvChange} />
    {pendingCvText !== null && (/* inline confirm YES/NO */)}
    <button onClick={handleAnalyse} disabled={cvText.trim().length < 50 || loading}>ANALYSE CV →</button>
    {loading && (/* spinner */)}
    {error && <p style={{ color: "#FF3D00" }}>{error}</p>}
  </div>
) : (
  /* TRYB WYNIKÓW — dwukolumnowy */
  <>
    {/* BANNER */}
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <p style={{ color: "#666666", fontSize: "0.8rem" }}>Showing previous results. Clear to run a new analysis.</p>
      <button onClick={clearAll} style={{ color: "#E8FF00" }}>CLEAR →</button>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="lg:col-span-3">
        <ReviewResultComponent result={reviewResult} />
      </div>
      <aside className="lg:col-span-2" style={{ position: "sticky", top: "24px", alignSelf: "start", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* CV PREVIEW PANEL */}
        <div style={{ border: "1px solid #222222", background: "#111111", padding: "1rem" }}>
          <p style={{ fontSize: "0.65rem", color: "#666666", textTransform: "uppercase", letterSpacing: "0.2em" }}>Your CV</p>
          <div style={{ color: "#444444", fontSize: "0.8rem", whiteSpace: "pre-wrap", overflow: "hidden" }}>
            {cvText.split("\n").slice(0, 3).join("\n")}
          </div>
          <button onClick={clearAll} style={{ color: "#E8FF00" }}>EDIT CV ↓</button>
        </div>
        <TailorSection cv={cvText} mode="general" jobDescription="" missingKeywords={[]} suggestions={[]} />
      </aside>
    </div>
  </>
);
```

### Edge case'y (review)
- **TailorSection z `mode="general"` NIE wymaga JD** (potwierdzone w `TailorSection.tsx` linie 28-33: w trybie general guard sprawdza tylko `cv.trim()`; wywołuje `tailorCVGeneral`). Dlatego `jobDescription=""` i `suggestions={[]}` zgodnie z briefem są POPRAWNE i bezpieczne — żadnej zmiany w TailorSection/backendzie nie trzeba. (To koryguje wcześniejszą obawę — nie dotyczy trybu general.)
- Wszystkie hooki (`useCVContext`, `useState` loading/error/pendingCvText, ewentualny useMemo/useCallback) PRZED ternary. Render warunkowy wyłącznie przez ternary w JSX — brak early return.
- W trybie wyników `CvInput` nie jest renderowany; edycja CV przez `EDIT CV` / `CLEAR` → `clearAll()` → powrót do trybu formularza. `handleCvChange` z gałęzią `reviewResult !== null` jest defensywny (martwy w obecnym layoucie review) — implementować dla spójności z analyse i przyszłych zmian.
- Preview snippet: pusty `cvText` nie wystąpi w trybie wyników (wyniki implikują podane CV). Długie linie bez `\n` — `overflow: hidden` zabezpiecza panel.
- Mobile (`grid-cols-1`): kolumny stackują; sticky nieaktywny w jednokolumnowym stacku (akceptowalne).

---

## Krok 4 — `frontend/app/analyse/page.tsx`

(Plik 227 linii — coder zachowuje istniejące bloki MatchScore/Keywords/Suggestions/Summary, modal, save.)

### Stan: usunąć / dodać
- USUNĄĆ lokalny `useState`: `cv`, `jd`, `result`.
- ZACHOWAĆ lokalny: `loading`, `error`, `showModal`, `saved`.
- DODAĆ z contextu (NA GÓRZE): `const { cvText, setCvText, jobDescription, setJobDescription, analyseResult, setAnalyseResult, clearAll } = useCVContext();`
- DODAĆ lokalny: `const [pendingCvText, setPendingCvText] = useState<string | null>(null);`
- DODAĆ import `useCVContext`. `type AnalyseResult` import usunąć, jeśli nieużywany po migracji.

### Logika
- `cv` → `cvText`, `jd` → `jobDescription`, `result` → `analyseResult`, `setResult` → `setAnalyseResult` w całym pliku.
- Handler analizy: `setAnalyseResult(...)` po sukcesie.
- `showModal`/`saved`/save flow — bez zmian logiki, tylko źródła `cv`/`jd`/`result` zaktualizować na context. SaveApplicationModal czyta teraz `cvText`/`jobDescription`.
- CV `onChange` → `handleCvChange` (identyczny wzorzec jak review: `analyseResult !== null` → `setPendingCvText`, else `setCvText`).
- JD textarea → `onChange={(e) => setJobDescription(e.target.value)}` bezpośrednio (zmiana JD nie wymaga confirm).
- Inline confirm — identyczny YES/NO jak w review.

### Struktura JSX (szkic)
```jsx
return analyseResult === null ? (
  /* FORMULARZ — obecny układ */
  <div>
    {/* nagłówek */}
    <CvInput value={cvText} onChange={handleCvChange} />
    <textarea value={jobDescription} onChange={(e)=>setJobDescription(e.target.value)} />
    {pendingCvText !== null && (/* confirm YES/NO */)}
    {error && <p>}
    <button onClick={runAnalyse} disabled={loading}>ANALYSE</button>
  </div>
) : (
  /* WYNIKI — dwukolumnowy */
  <>
    {/* BANNER (jak w review) */}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="lg:col-span-3" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* MatchScore, Keywords, Suggestions, Summary — istniejące bloki */}
      </div>
      <aside className="lg:col-span-2" style={{ position: "sticky", top: "24px", alignSelf: "start", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* CV PREVIEW PANEL (identyczny jak review) */}
        <TailorSection
          cv={cvText}
          jobDescription={jobDescription}
          missingKeywords={analyseResult.missing_keywords}
          suggestions={analyseResult.suggestions}
        />
      </aside>
    </div>
    {showModal && (/* SaveApplicationModal — overlay, poza gridem */)}
  </>
);
```

### Edge case'y (analyse)
- `TailorSection` tutaj `mode` domyślny ("targeted") — JD jest niepuste w typowym flow (analyse wymagał JD), więc guard przejdzie.
- TailorSection PRZENIEŚĆ z lewej (był inline w wynikach) do prawej kolumny; usunąć poprzednie wystąpienie.
- Wszystkie hooki przed ternary/return.
- `clearAll` z analyse czyści też `reviewResult` i `jobDescription` — patrz Ryzyko 1.
- Modal renderować poza gridem (overlay), jak dotychczas.

---

## Powtarzalne elementy UI (banner / confirm / CV preview)
Identyczne na obu stronach. Brief NIE każe tworzyć nowych plików poza `cv-context.tsx`, a reguła "nie zmieniać innych komponentów" nie zabrania nowych. Duplikacja ~10-15 linii inline jest akceptowalna i preferowana, by trzymać się listy 4 plików. Coder może opcjonalnie wydzielić do `components/`, ale to rozszerza zakres — domyślnie inline.

## Ryzyka i na co uważać

1. **`clearAll` jest globalny** — czyści `cvText`, `jobDescription`, `reviewResult`, `analyseResult`. Plus: nawigacja /review → /analyse zachowuje `cvText`. Minus: `CLEAR`/`EDIT CV`/confirm-YES na jednej stronie wyzeruje też dane drugiej (w tym JD na analyse po YES). Zgodne z briefem (spec mówi `clearAll`); świadomy trade-off. Jeśli reviewer uzna utratę JD za UX-bug — kandydat na osobny `clearReview`/`clearAnalyse`, ale NIE w tym zakresie.

2. **Provider bez wrappera DOM** — `CVProvider` musi zwracać `<CVContext.Provider>{children}</CVContext.Provider>` bez extra `<div>`, inaczej zepsuje `flex` layout `<body>` (Sidebar obok main).

3. **Reguła hooków (auto-memory):** wszystkie hooki przed warunkowym return. Plan używa ternary w JSX (nie early return) — bezpieczne. `useCVContext()` jako pierwsza linia ciała komponentu. Dotyczy też `useMemo` w Providerze.

4. **Nieużywane importy** — po migracji `type ReviewResult` (review) i `type AnalyseResult` (analyse) mogą stać się nieużywane → ESLint error w `npm run build`. Usunąć. `PdfExportSection` usuwany z review całkowicie.

5. **Sticky aside** — `position: sticky` wymaga `alignSelf: "start"` na elemencie grid, inaczej kolumna rozciąga się na pełną wysokość i sticky nie działa.

6. **Confirm path w review praktycznie nieosiągalny** — w trybie wyników review nie renderuje `CvInput`, więc `handleCvChange` z gałęzią wyników jest defensywny. Odnotować dla reviewera; nie jest błędem.

7. **In-memory only** — zero storage. Full reload czyści context (oczekiwane); nawigacja klient-side (Link) zachowuje stan.

8. **Brak `console.log`** — w catch tylko `console.error`.

9. **Weryfikacja:** `cd frontend && npm run build` (TS strict + ESLint) musi przejść — brak `any`, brak nieużywanych importów, brak hooków po returnie.
