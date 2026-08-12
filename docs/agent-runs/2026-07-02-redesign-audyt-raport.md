# Raport: Redesign HIREWORTHY

Nazwa bazowa pipeline: `2026-07-02-redesign-audyt`

---

## Next 16 — ustalenia (krok zerowy)

Guide'y istnieją pod `frontend/node_modules/next/dist/docs/` (429 plików `.md`, App Router pod `01-app/`). Nie były puste — lektura wykonana przed kodem.

Ustalenia istotne dla implementacji:

1. **Dynamic route `params` to Promise.** Potwierdzone w `01-app/01-getting-started/03-layouts-and-pages.md` i `01-app/01-getting-started/05-server-and-client-components.md`:
   ```tsx
   export default async function Page({ params }: { params: Promise<{ id: string }> }) {
     const { id } = await params;
     ...
   }
   ```
   Dotyczy przyszłej strony `/applications/[id]` (Faza 5) — Faza 1 nie tworzy nowych route'ów dynamicznych, więc nie ma bezpośredniego zastosowania teraz, ale trzeba o tym pamiętać w kolejnych fazach.

2. **Server/Client Components boundary.** `'use client'` deklaruje granicę modułów — wszystko co dany plik importuje/renderuje bezpośrednio trafia do bundla klienckiego. Layouty/strony są Server Components domyślnie; do stanu, event handlerów, hooków (`useState`, `useEffect`, custom hooks), API przeglądarki (`window`, `sessionStorage`) wymagane jest `'use client'`. Context providers (React Context) NIE działają w Server Components — muszą być owinięte w komponent kliencki (co już ma miejsce: `CVProvider` w `lib/cv-context.tsx` ma `"use client"`).

3. **`next/font/google`.** API zgodne z tym, co już jest użyte w `app/layout.tsx` (`Space_Grotesk`, `Inter` przez `next/font/google`, `variable` + `display: "swap"`, aplikowane przez `className` na `<html>`). Brak zmian koniecznych — istniejący kod już stosuje aktualny wzorzec.

Wniosek dla Fazy 1: żadna z powyższych zmian API nie wymaga modyfikacji w zakresie tej fazy (brak nowych dynamic route'ów, layout.tsx już poprawnie używa next/font). Istotne dopiero od Fazy 5 (`/applications/[id]`, `await params`).

---

## Faza 1 — wykonane zmiany (coder)

### `backend/requirements.txt`
Dopisano `asyncpg==0.29.0` (linia przed `weasyprint`). `backend/database.py` importuje `asyncpg` i używa `asyncpg.create_pool`/`asyncpg.Pool`, a pakiet nie był wymieniony w requirements — bez tego `pip install -r requirements.txt` nie stawiał zależności potrzebnej do uruchomienia serwera. Nic nie usunięto.

### `backend/.env`
Utworzono z pustymi placeholderami:
```
DATABASE_URL=
ANTHROPIC_API_KEY=
```
Zero sekretów — użytkownik dostarczy wartości. Root `.gitignore` (`A:\Desktop\AI-job-tracker-main\.gitignore`) już zawiera globalny wzorzec `.env`, który obejmuje `backend/.env` — nie był potrzebny osobny `backend/.gitignore`.

Instrukcja uruchomienia (do wykonania przez agenta/dewelopera lokalnie, poza zakresem tego zadania — brak dostępu do Bash):
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
# uzupełnić backend/.env: DATABASE_URL (np. z docker-compose up db lub Supabase), ANTHROPIC_API_KEY
uvicorn main:app --reload
```

### `frontend/lib/api.ts`
`request<T>()`: dodano obsługę pustych odpowiedzi — jeśli `res.status === 204` lub `content-length === "0"`, zwraca `undefined as T` bez wołania `res.json()`. Dla pozostałych przypadków czyta `res.text()` i parsuje ręcznie (`JSON.parse`), z fallbackiem na `undefined` gdy tekst jest pusty. Naprawia crash przy `DELETE /applications/{id}` (backend zwraca 204 bez body, poprzedni kod bezwarunkowo wołał `res.json()`, co rzucało błędem parsowania JSON). Obsługa błędów HTTP (>=400, `err.detail`) pozostawiona bez zmian.

### `frontend/app/applications/page.tsx`
- `handleStatusChange`: zamiast cichego `catch {}`, teraz robi optimistic update (od razu ustawia nowy status w UI), a przy błędzie API robi rollback do poprzedniego statusu i ustawia `actionError` (wyświetlany w kolorze `#FF3D00`, zgodnie z paletą). `console.error(e)` w catch — zgodnie z konwencją (dozwolone).
- `handleDelete`: zamiast cichego `catch {}`, przy błędzie ustawia `actionError` i loguje `console.error(e)`. Wiersz nie znika z UI dopóki DELETE się nie powiedzie.
- Dodano `actionError` state i render `<p>` pod istniejącym `error` (ten sam styl wizualny).

### `frontend/app/layout.tsx`
Usunięto inline `style={{ marginLeft: "72px" }}` z `<main>`, zastąpiono klasą `app-content`. Powód: inline style nadpisywał wcześniej specyficzność, przez co logika mobile w CSS musiała polegać na `!important`; przeniesienie do CSS porządkuje źródło prawdy o layoutcie strony (jedna klasa, jeden plik).

### `frontend/app/globals.css`
- Dodano `.app-content { margin-left: 72px; }` (desktop) — odpowiednik usuniętego inline stylu z `layout.tsx`.
- Sekcja mobile (`@media (max-width: 640px)`): zmieniono selektor z `main` na `.app-content` (zgodność z nową klasą), zachowano `margin-left: 0` i `padding-bottom: 72px` scalone w jeden blok `.app-content` zamiast dwóch osobnych reguł na `main`. **Uwaga:** przy eksploracji okazało się, że sam mechanizm bottom-nav (fixed, 56px, bez przykrywania treści) już istniał w pliku przed zmianami tej sesji — opis buga w zadaniu ("fixed 100vh, z-index 40 przykrywa treść") nie odpowiadał aktualnemu stanowi kodu. Zmiana ograniczona do uporządkowania selektora zgodnie z krokiem 5 planu (usunięcie zależności od inline `marginLeft`), bez przepisywania działającej logiki bottom-nav.
- Sidebar hover-expand (desktop, bug 6): dodano `box-shadow` na `.sidebar-shell:hover` (wizualne oddzielenie panelu od treści) oraz **scrim** — półprzezroczyste tło (`rgba(0,0,0,0.5)`) na `.app-content::before`, aktywowane przez `body:has(.sidebar-shell:hover)`. Rozwiązuje problem "hover-expand zasłania treść": sidebar nadal fizycznie nachodzi na ok. 96px treści przy rozwinięciu (72px→200px, margines treści 72px + padding 32px), ale scrim przygasza i wizualnie "wyłącza" treść pod overlayem tylko na czas hover — nie ma to charakteru stałego zasłonięcia (znika natychmiast po zjechaniu myszą z sidebara), nie ma layout-shiftu (margines treści pozostaje stały 72px). Wybrany wariant to hybryda rekomendacji (b) z planu + "półprzezroczysty backdrop" wymieniony jako alternatywa. `:has()` jest wspierany we wszystkich głównych przeglądarkach (Chrome/Edge/Safari/Firefox 2023+); brak polyfilla w projekcie — jeśli to problem, do zgłoszenia przez reviewera.

### `frontend/app/dashboard/page.tsx`
- `weekStart()` → rozbite na `weekStartISO()` (zwraca klucz ISO `yyyy-mm-dd` używany do sortowania) i `formatWeekLabel()` (formatuje ISO na etykietę `"08 Jun"` dopiero przy wyświetlaniu).
- `barData`: teraz trzyma `weekStartDate` (ISO, do sortowania) obok `week` (sformatowana etykieta, używana niezmienioną jako `dataKey="week"` w `<XAxis>`) i `count`. Sortowanie `.sort((a,b) => a.weekStartDate.localeCompare(b.weekStartDate))` — poprawne chronologicznie (ISO string sortuje się leksykograficznie zgodnie z czasem), naprawia bug sortowania po sformatowanej etykiecie (`"08 Jun".localeCompare("03 Jul")` dawało błędną kolejność, bo "0" < "3" ale czerwiec < lipiec nie zawsze wygrywał poprawnie przy zmianie roku/miesiąca).

### `frontend/lib/cv-context.tsx`
Dodano do kontekstu: `resultIsStale: boolean`, `markResultStale()`, `markResultFresh()`. `resultIsStale` domyślnie `false`, resetowane do `false` w `clearAll()`. Mechanizm: strony (`/analyse`, `/review`) w `useEffect` on-mount (guard przez `useRef`, uruchamia się raz) sprawdzają, czy wynik już istnieje w kontekście — jeśli tak, oznaczają go jako stale (bo to oznacza, że użytkownik wrócił na stronę z wynikiem odziedziczonym z poprzedniej wizyty). Po świeżym submit (`handleAnalyse`) strona jawnie woła `markResultFresh()` zaraz po ustawieniu wyniku, więc banner nie pojawia się natychmiast po analizie w tej samej sesji widoku.

### `frontend/app/analyse/page.tsx`
- Import `useEffect, useRef` dodany.
- Destrukturyzacja kontekstu rozszerzona o `resultIsStale, markResultStale, markResultFresh`.
- Nowy `useEffect` (mount-only, `didMount` ref guard) — jeśli `analyseResult !== null` przy mouncie, woła `markResultStale()`.
- `handleAnalyse`: po `setAnalyseResult(...)` woła `markResultFresh()`.
- Warunek renderu bannera zmieniony z `analyseResult !== null` na `analyseResult !== null && resultIsStale`.

### `frontend/app/review/page.tsx`
Analogicznie do `analyse/page.tsx`: import `useEffect, useRef`, mount-effect z `markResultStale()`, `markResultFresh()` po świeżym `setReviewResult(...)` w `handleAnalyse`, banner opakowany w `{resultIsStale && (...)}` (zagnieżdżony w istniejącym `{reviewResult !== null && (...)}` bloku).

---

### Rzeczy do zweryfikowania przez reviewer/test-writer (nie naprawiane w tej sesji — poza zakresem coder)
- Wizualna weryfikacja scrim + hover-expand sidebar na realnym ekranie (brak działającego dev servera z backendem/bazą w tej sesji — zmiany nie zostały zweryfikowane w przeglądarce).
- Zachowanie `body:has()` w środowiskach bez wsparcia dla `:has()` (starsze przeglądarki) — obecnie brak fallbacku.
- Edge case rollback w `handleStatusChange`: jeśli `previous` jest `undefined` (aplikacja usunięta w międzyczasie z innej karty), rollback jest pomijany — zachowanie zamierzone (nie ma do czego wracać), ale warto potwierdzić testem.
- `npm run build` / `npm run lint` nie zostały uruchomione w tej sesji (brak dostępu do Bash) — zalecane przed merge.

---

## Faza 1 — poprawki głównej sesji po weryfikacji runtime

Weryfikacja na działającym mocku wykazała, że punkt 5 (mobile sidebar) nie był naprawiony przez codera: coder ocenił CSS w globals.css jako poprawny, ale prawdziwym źródłem bugu był INLINE STYLE w `frontend/components/Sidebar.tsx` (`position:fixed;top:0;left:0;height:100vh;z-index:40`), który nadpisywał media query — na mobile sidebar dalej przykrywał cały viewport.

Poprawki głównej sesji:
1. `frontend/components/Sidebar.tsx` — usunięty inline style pozycjonujący; pozycjonowanie przeniesione do `globals.css`.
2. `frontend/app/globals.css` — `.sidebar-shell` dostał `position:fixed; left:0; z-index:40` w bazie, a pion (`top:0; height:100vh`) w `@media (min-width: 641px)`. UWAGA-PUŁAPKA: pierwotna próba `top: auto` w mobile query NIE działa — lightningcss (minifier Turbopacka) usuwa `top: auto` jako wartość początkową, przez co nie nadpisuje wcześniejszego `top: 0`. Stąd wzajemnie wykluczające się media queries zamiast override'u.

Weryfikacja runtime po poprawkach (mock backend + Next dev):
- mobile 375px: treść widoczna, bottom-nav przypięty do dołu (y=756, h=56) ✓
- DELETE: wiersz znika po 204; przy 404 widoczny komunikat "Application not found" ✓
- bar chart: oś chronologiczna (27 Apr → 29 Jun) ✓
- banner "Showing previous results": brak po świeżym submit, obecny po powrocie na stronę ✓
- `npm run lint` + `npm run build` (strict TS): czysto, exit 0 ✓
- scrim przy hover-expand: reguła CSS obecna; realny hover nietestowalny automatycznie — do potwierdzenia wizualnego

---

## Faza 2 — wykonane zmiany (coder)

### Tokeny kolorów/borderów
- `frontend/app/globals.css`: dodano drugi poziom borderu `--border-strong: #333333` (`:root`) i zmapowano go w `@theme inline` jako `--color-border-strong` (obok istniejącego `--color-border` → `#222222`). Reszta tokenów (`--secondary`/`--muted` #1a1a1a, `--accent` #E8FF00, `--destructive` #FF3D00 itd.) już istniała od wcześniejszej sesji scaffoldu — nie duplikowano źródła prawdy przez osobny `lib/design-tokens.ts` (plan dopuszczał „@theme w globals.css LUB nowy plik”; wybrano istniejące `@theme`, bo już było kompletne).
- Nie zmigrowano hurtowo WSZYSTKICH literałów `#1a1a1a/#222222/#333333/#444444` w całym repo na `var()` — plan explicite wskazywał do slate-cleanupu tylko `CvInput.tsx` i `HeatmapGrid.tsx` (patrz niżej). Reszta plików już i tak używała tych samych wartości co tokeny (spójne wizualnie), więc pozostawiono jako inline hex zgodnie z istniejącym stylem repo. Odnotowuję to jako świadome ograniczenie zakresu — do potwierdzenia, czy Faza 3 ma to dokończyć.

### Slate cleanup + border-radius
- `frontend/components/CvInput.tsx`: drag&drop strefa — `background: #1e293b` → `#111111`, `border: 2px dashed #334155` (idle) → `#222222` (aktywny `#E8FF00` bez zmian). Usunięto `border` z `baseInputStyle` (inline) i przeniesiono do klasy `border border-border focus:border-[#E8FF00]` na `<textarea>` — konieczne, bo inline `style.border` miałby wyższą specyficzność niż klasa `focus:` i migracja focus/blur (patrz niżej) by nie zadziałała wizualnie.
- `frontend/components/HeatmapGrid.tsx`: tooltip — `background: #1e293b` → `#111111`, `border: 1px solid #334155` → `#222222`; `borderRadius: "2px"` (komórki siatki + tooltip) → `0`, zgodnie z globalnym `border-radius: 0 !important`.
- Skala intensywności heatmapy (`COLORS = {0: "#1a1a1a", 1: "#4a5a00", 2: "#8aaa00"}`) pozostawiona bez zmian — to nie jest token borderu/surface tylko celowa skala kolorów natężenia, poza zakresem „slate cleanup”.

### Font Space Grotesk / skala nagłówków
- `frontend/app/layout.tsx` i `frontend/app/globals.css`: bez zmian — `Space_Grotesk` już ładowany przez `next/font/google`, `--font-display` w `@theme` już wskazuje na `--font-space-grotesk`, `.font-display` i selektory `h1-h5` już go używały. Zweryfikowano, nic do zrobienia.
- `frontend/app/globals.css`: dodano klasę `.h1 { font-size: clamp(2rem, 5vw, 3rem); line-height: 1.1; }` jako jedno źródło prawdy dla nagłówków sekcji stron.
- Zastosowano `.h1` (zamiast sztywnego `fontSize: "3rem"`) na: `frontend/app/dashboard/page.tsx`, `frontend/app/applications/page.tsx`, `frontend/app/analyse/page.tsx` — to były trzy strony wskazane w planie jako niespójne (sztywne 3rem).
- `frontend/app/page.tsx` (landing, `clamp(2rem, 5vw, 3.5rem)`) i `frontend/app/review/page.tsx` (`clamp(1.5rem, 3vw, 2.5rem)`) pozostawione z własnymi inline clampami — to są H1 w innym kontekście (landing hero pełnoekranowy vs review formularz w wąskiej kolumnie), plan nie kazał ujednolicać ich między sobą ani z `.h1`, tylko naprawić sztywne `3rem` na trzech wskazanych stronach. Odnotowuję jako decyzję interpretacyjną — do potwierdzenia czy landing/review mają też przejść na `.h1` w Fazie 3.

### Button system (cva) — `frontend/components/ui/button.tsx`
- Plik już zawierał działający cva-based `Button` (wbrew opisowi zadania „martwy plik”) oparty o `@base-ui/react/button`, ale z generycznymi nazwami wariantów (`default/outline/secondary/ghost/destructive/link`) i zaokrąglonymi rogami (`rounded-lg` itd.) niepasującymi do palety projektu — i nieużywany nigdzie poza `components/ui/dialog.tsx` (wewnętrzny close button, warianty `ghost`/`outline`).
- Przeprojektowano warianty: `primary` (neon `bg-primary`/`text-primary-foreground`, domyślny), `secondary` (hairline `border-border`, transparent bg — odpowiednik dawnego „outline”), `ghost` (bez border, hover `bg-muted`), `danger`/`destructive` (`bg-destructive`), `default`/`outline`/`link` zachowane jako aliasy dla wstecznej kompatybilności z `dialog.tsx` (który używa `variant="ghost"` i `variant="outline"` — nie złamane).
- Usunięto `rounded-*` z rozmiarów (zbędne — `border-radius: 0 !important` jest globalne w `@layer base`), dodano `font-display font-bold uppercase tracking-widest` do bazowych klas (spójne z resztą CTA w apce), rozmiary dopasowane do realnych wysokości przycisków w repo (`h-10`/`h-8`/`h-12` zamiast `h-8`/`h-7`/`h-9` z shadcn defaultów).
- `disabled:opacity-50` (odziedziczone z bazowych klas cva) zastępuje dawne ad-hoc kolory disabled (`#1a1a1a`/`#444444`/`#b3c700`) na przyciskach CTA migrowanych do `Button`. To spójniejsze zachowanie systemowe, ale subtelna zmiana wizualna (przyciemnienie przez opacity zamiast zmiany koloru tła) — dotyczy: CTA "Analyse →"/"Analyse CV →" (analyse, review), "Tailor CV →"/"FIX & OPTIMISE CV →" (TailorSection), "Save" (SaveApplicationModal), "Download PDF →" (PdfExportSection). Odnotowuję jako świadomą decyzję do potwierdzenia wizualnego przez reviewer.

### Migracja przycisków na `<Button>` (kompletna lista plików)
- `frontend/components/CvInput.tsx` — toggle „Paste text”/„Upload PDF” (primary/secondary wg aktywnego trybu, `size="sm"`). Mikro-link „Change file” (inline tekst w `<p>`) pozostawiony jako plain `<button>` — pełny `Button` (inline-flex + padding z `size` wariantów) rozjeżdżałby inline-tekstowy layout; poza zakresem „przycisk akcji”.
- `frontend/components/TailorSection.tsx` — „Tailor CV →”/„FIX & OPTIMISE CV →” (primary), „Copy Tailored CV →” (secondary + custom neon-outline kolory przez `className`, `variant="secondary"` jako baza).
- `frontend/components/PdfExportSection.tsx` — layout toggle classic/modern/split (primary/secondary), „Download PDF →” (primary). Kołowe swatche kolorów (`borderRadius: "50%"`) NIE zmigrowane na `Button` — custom shape, i tak już łamane globalnie przez `border-radius: 0 !important` (przedistniejący bug, niezwiązany z tym zadaniem — odnotowany, nienaprawiany bez zgody).
- `frontend/components/SaveApplicationModal.tsx` — „Cancel” (secondary), „Save” (primary). Input focus/blur zmigrowany z `onFocus/onBlur` mutujących `style.borderColor` na `border border-border focus:border-[#E8FF00]`. Przycisk „X” (zamknięcie modala) pozostawiony jako plain `<button>` — już używał klasy Tailwind `hover:text-white`, nie inline-hover.
- `frontend/app/applications/page.tsx` — delete-icon button (`variant="ghost" size="icon-sm"`, hover koloru przez Tailwind zamiast `onMouseEnter/onMouseLeave` mutujących `style.color`); CTA „Go to Analyse →” w empty state (`<a>` + `buttonVariants()`, bo to link nawigacyjny, nie `<button>`).
- `frontend/app/analyse/page.tsx` — CLEAR (ghost), YES/NO w confirm-dialogu (primary/secondary), CTA „Analyse →” (primary), „Save Application →” (secondary + custom neon-outline). Textarea job description: `onFocus/onBlur` → `focus:border-[#E8FF00]`. Suggestion `motion.div` hover na `borderLeftColor`: `onMouseEnter/onMouseLeave` → Tailwind `border-l-2 border-l-border hover:border-l-[#E8FF00]` (framer-motion `whileHover={{x:6}}` zachowany bez zmian, bo to animacja transformu, nie mutacja koloru).
- `frontend/app/review/page.tsx` — analogicznie: YES/NO, CTA „Analyse CV →”, CLEAR, „EDIT CV ↓” (wszystkie na `Button` z odpowiednimi wariantami).
- `frontend/app/page.tsx` (landing) — CTA „Review my CV →”/„Match to a job →” w hero i „REVIEW MY CV →” w bottom CTA: `<Link>` + `buttonVariants()` (nie `<Button>` bezpośrednio, bo to nawigacja `next/link`, nie akcja `onClick`).

### Responsywne gridy (landing, punkt 7 planu)
- `frontend/app/page.tsx`: sekcje „How it works” i „What you get” — `gridTemplateColumns: "1fr 1fr 1fr"` (inline) → `className="grid grid-cols-1 md:grid-cols-3"` (gap zachowany jako inline `style` dla minimalnej zmiany).

### Migracja inline hover → Tailwind — pełna lista
- `frontend/components/CategoryBreakdown.tsx`: `onMouseEnter/onMouseLeave` mutujące `borderColor` karty kategorii → `className="border border-border hover:border-[#E8FF00]"`.
- Pozostałe `onMouseEnter/onMouseLeave` znalezione w repo (`frontend/components/HeatmapGrid.tsx` — pozycja tooltipa pod kursorem; `frontend/components/Sidebar.tsx` — `setExpanded` state sterujący hover-expand) NIE zostały migrowane — to nie są imperatywne mutacje `.style`, tylko standardowy wzorzec React `useState` + warunkowy re-render (deklaratywny, zgodny z konwencjami; nie da się zastąpić czystym CSS `:hover`, bo zmienia się treść/layout, nie tylko kolor).

### Weryfikacja kompletności (grep po całym `frontend/app` + `frontend/components`, z pominięciem `.next`/`node_modules`)
- `#1e293b` / `#334155`: 0 wystąpień — cleanup kompletny.
- `onMouseEnter`/`onMouseLeave` mutujące styl inline: 0 wystąpień poza uzasadnionymi wyjątkami wymienionymi wyżej.
- `fontSize: "3rem"` (sztywny): 0 wystąpień w źródłach (tylko w `.next` build cache, odświeży się przy kolejnym buildzie).

### Nie zrobione / poza zakresem tej sesji (do potwierdzenia)
- Hurtowa migracja WSZYSTKICH literałów hex (`#1a1a1a`, `#222222`, `#333333`, `#444444` poza CvInput/HeatmapGrid) na `var(--color-*)` — plan nie wskazywał tego explicite poza dwoma plikami; wartości są już spójne z tokenami, ale nie referencjonują ich programowo.
- `npm run build` / `npm run lint` — NIE uruchomione w tej sesji (brak dostępu do Bash w roli coder). Zalecane przed merge, szczególnie pod kątem: użycia `buttonVariants()` na `<a>`/`<Link>` (typy generowane przez `cva` bez `ButtonPrimitive.Props` — powinno być OK, `buttonVariants` to czysta funkcja zwracająca string klas, ale niepotwierdzone kompilacją), oraz `border-l-border` (czy Tailwind poprawnie generuje klasę z tokenu `--color-border` dla `border-l-*`).
- Weryfikacja wizualna w przeglądarce (regresja layoutu przy zmianie rozmiarów przycisków h-8/h-10/h-12 z nowego `button.tsx` vs oryginalne ad-hoc paddingi) — nie wykonana, zalecana dla reviewer/test-writer.

---

## Faza 4 — wykonane zmiany (coder)

Zakres: uporządkowanie PDF — usunięcie martwego endpointu serwerowego `/pdf/generate` (zawsze zwracał 503, weasyprint niedostępny bez GTK3 na Windows) i zastąpienie klienckiego `window.open()+window.print()` (obserwowane zawieszanie renderera podczas audytu) mechanizmem opartym o `@media print` na bieżącym oknie, bez otwierania nowego okna. `POST /pdf/extract` pozostał bez zmian.

### Backend

**`backend/routes/pdf.py`**
- Usunięto endpoint `POST /generate` w całości (funkcja `generate_pdf`, blok `try/except ImportError` na `weasyprint`, import `Response` z `fastapi` — teraz nieużywany, usunięty z importów).
- Usunięto import `from pdf_templates import build_html` oraz `from models import PDFGenerateRequest, ...` (zostawiono tylko `PdfExtractResponse`).
- `POST /extract` (pdfplumber + `clean_cv_text_ai`) — bez żadnych zmian w logice.

**`backend/pdf_templates.py`**
- Zawartość pliku wyzerowana (plik pusty). **Uwaga/ograniczenie środowiska:** rola coder w tej sesji nie ma dostępu do Bash ani do narzędzia usuwającego pliki — nie mogłem fizycznie skasować pliku z dysku, tylko wyczyścić jego zawartość. Zalecenie dla kogoś z dostępem do powłoki: `git rm backend/pdf_templates.py` (lub zwykłe `del`/`rm`), żeby nie zostawiać pustego pliku w repo. Potwierdzone: żaden plik `.py` w `backend/` (poza `venv/`) już go nie importuje.

**`backend/models.py`**
- Usunięto `class PDFGenerateRequest` (wraz z propertym `safe_color` i lokalnym `import re as _re`).
- Usunięto nieużywany po tej zmianie import `Literal` z `typing` (był używany wyłącznie w `PDFGenerateRequest.layout: Literal["classic","modern","split"]`).
- Reszta modeli (w tym `PdfExtractResponse` używany przez `/pdf/extract`) bez zmian.

**`backend/requirements.txt`**
- Usunięto linię `weasyprint  # PDF generation. Windows: requires GTK3...`. Reszta zależności (w tym `asyncpg` dopisane w Fazie 1) bez zmian.

**Testy (`backend/tests/test_pdf.py`, `conftest.py`)**
- Sprawdzone: `test_pdf.py` testuje wyłącznie `POST /pdf/extract` (9 testów: valid PDF, non-PDF rejection, fake extension, too large, no text layer, multi-page, corrupted, whitespace-only, mixed empty/non-empty pages). Zero odniesień do `/pdf/generate`, `PDFGenerateRequest` czy `weasyprint`. **Nic do usunięcia/aktualizacji** — plan zakładał aktualizację "jeśli" test_pdf.py testuje generate; nie testował.
- `conftest.py` importuje `main.app` bez żadnych odniesień do usuniętego kodu — działa bez zmian.

### Frontend

**`frontend/components/CVPreview.tsx`**
- Zrefaktoryzowano wewnętrznie: wydzielono `buildCVFragment(cvText, layout, color)` — wspólna funkcja budująca `{ innerHtml, containerStyle }` (fragment HTML CV + inline CSS kontenera jako string) dla wszystkich trzech layoutów (classic/modern/split), bez duplikacji logiki parsowania CV.
- `buildPreviewHtml(...)` (eksport istniejący, używany przez iframe podglądu w `PdfExportSection` i domyślny `CVPreview` component) — zachowany jako publiczne API, teraz cienki wrapper nad `buildCVFragment`, zwraca identyczny pełny dokument HTML co przed zmianą (string bajt-w-bajt równoważny; jedyna różnica to dodane redundantne `box-sizing:border-box` do inline stylu body, bez efektu wizualnego bo `*{box-sizing:border-box}` już to wymuszał globalnie w tym samym dokumencie).
- Nowy eksport `buildPrintFragment(cvText, layout, color): CVFragment` — zwraca **tylko** wnętrze `<body>` (bez `<html>/<head>/<body>` wrapperów) + string CSS kontenera, do wstrzyknięcia bezpośrednio w główny DOM aplikacji (nie w iframe) przez `dangerouslySetInnerHTML`. Powód: `window.print()` na głównym oknie drukuje główny dokument — potrzebny fragment renderowalny w tym samym DOM, nie zagnieżdżony dokument iframe (drukowanie zawartości iframe jest niespójne między przeglądarkami).
- Domyślny eksport `CVPreview` (komponent z iframe + skalą 0.38) pozostawiony bez zmian funkcjonalnych — sprawdzone przez grep: obecnie nieużywany nigdzie w repo poza samym plikiem (żaden import `import CVPreview from ...`), tylko named exporty `buildPreviewHtml`/`buildPrintFragment` są konsumowane przez `PdfExportSection.tsx`. To był stan sprzed zmian tej sesji, nieporuszony.

**`frontend/components/PdfExportSection.tsx`**
- Usunięto `handleDownloadPDF` oparte o `window.open("", "_blank")` + `win.document.write(html)` + `win.print()` (mechanizm identyfikowany w planie jako źródło zawieszania renderera) oraz towarzyszący stan `pdfLoading`/`pdfError` i import `Loader2` (nie były już potrzebne — `window.print()` na bieżącym oknie jest wywołaniem synchronicznym z natywnym UI drukowania przeglądarki, nie ma stanu sieciowego do odzwierciedlenia; błąd popup-blockera też już nie występuje, bo nie otwieramy nowego okna).
- Nowa implementacja `handleDownloadPDF` = `window.print()` (jedna linia, bez otwierania okna).
- Dodano portal (`createPortal` z `react-dom`) renderujący `<div id="pdf-print-root">` z `dangerouslySetInnerHTML` wypełnionym `buildPrintFragment(...)` bezpośrednio jako dziecko `document.body`. Portal jest zawsze zamontowany (gdy `mounted === true`, ustawiane w `useEffect` po pierwszym renderze — standardowy guard na SSR/hydration dla `document`/`window`), ale na ekranie ukryty (`display:none` inline, `@media print` w globals.css nadpisuje na `display:block !important`).
- Dodano lokalny helper `cssStringToObject(css: string): Record<string,string>` — parsuje płaski string `"prop:value;prop:value"` (zwracany przez `buildPrintFragment().containerStyle`) na obiekt do użycia jako React `style` prop (React nie akceptuje `style` jako string na elementach niestandardowych bez `dangerouslySetInnerHTML` na całości, a chciałem zachować `id`/`dangerouslySetInnerHTML` jako osobne propsy dla czytelności).
- Layout wyboru (`classic`/`modern`/`split`) i wybór koloru akcentu (5 swatchy) — zachowane bez zmian, zgodnie z planem ("zachowaj istniejące opcje layoutu i kolor akcentu"). Utrzymanie 3 layoutów w czystym CSS print nie okazało się nadmiernie złożone: nie duplikowano CSS drukowania — wykorzystano JUŻ ISTNIEJĄCE, w pełni jasne (białe tło, ciemny tekst) inline style z `buildCVFragment` (który już wcześniej był zaprojektowany pod HTML→PDF przez przeglądarkę, tylko w innym oknie). Realny dodany kod to ok. 20 linii (`@media print` w CSS) + portal (~15 linii) — poniżej progu 150 linii z planu, więc **nie uproszczono do jednego layoutu**.

**`frontend/app/globals.css`**
- Dodano blok `@media print` (przed sekcją "Noise texture overlay"): `body > *:not(#pdf-print-root) { display:none !important }` izoluje CV od reszty aplikacji (sidebar, nav, formularz PdfExportSection, wszystkie inne strony) — działa, bo portal jest bezpośrednim dzieckiem `<body>`, a cała reszta aplikacji (`<CVProvider><Sidebar/><main>...</main></CVProvider>`, patrz `layout.tsx`) jest opakowana w jeden `<div className="flex ...">` też bezpośrednie dziecko `<body>`, więc selektor `body > *` je trafia jako całość.
- `#pdf-print-root { display:block !important; position:static; margin:0; box-shadow:none }` — pokazuje fragment CV w druku.
- `body::before { display:none !important }` w bloku print — wyłącza noise-texture overlay (dekoracyjna warstwa SVG na dark theme), żeby nie nakładała się na wydruk.
- `@page { size:A4; margin:0 }` — marginesy strony drukowanej kontrolowane przez `padding` już obecny w `containerStyle` layoutów (np. `padding:48px` w classic/modern), spójnie z tym, jak robił to poprzedni mechanizm w osobnym oknie.
- Kolory druku: **jasne** (białe tło `background:white`, ciemny tekst `#1a1a1a`/`#111`/`#333` w zależności od layoutu) — niezależnie od dark theme aplikacji. To nie była nowa decyzja tej sesji: `buildCVFragment`/dawny `build_html` w backendzie ZAWSZE renderowały CV na jasnym tle (Georgia/Arial na białym, kolory tekstu ciemne) — dziedziczone z oryginalnego mechanizmu drukowania w osobnym oknie, tylko teraz to samo jasne renderowanie trafia do głównego dokumentu zamiast do drugiego okna. Zgodnie z rekomendacją planu ("DRUK MA BYĆ jasny niezależnie od dark theme aplikacji") — nie wymagało dodatkowej pracy, bo już tak działało.

**`frontend/lib/api.ts`**
- `PDFLayout` (`"classic" | "modern" | "split"`) — **zachowany**, nieusuwany. Zweryfikowano przez grep: nie jest to martwy typ powiązany z backendowym `/pdf/generate` (mimo nazwy sugerującej powiązanie) — to czysto frontendowy typ używany do wyboru layoutu w podglądzie A4 i teraz w print fragment, zero odniesień do usuniętego endpointu. Żadnej funkcji wołającej `/pdf/generate` nie było w `api.ts` (weryfikacja grep: 0 wyników na `generate` w pliku) — nie było więc czego usuwać poza kosmetyką.
- Zmieniono wyłącznie nagłówek komentarza z `// --- PDF Generate ---` na `// --- PDF layout (client-side print rendering only, no backend endpoint) ---`, żeby nie sugerował istnienia server-side generate.
- `uploadPDF()` (`/pdf/extract`) — bez zmian.

### Decyzje i odstępstwa od dosłownego planu
1. **Fizyczne usunięcie `pdf_templates.py` niewykonane** — brak dostępu do narzędzia kasującego pliki/Bash w roli coder w tej sesji. Plik wyzerowany (0 bajtów treści), niereferencjonowany nigdzie w kodzie źródłowym. Wymaga ręcznego `git rm`/`del` przez kogoś z dostępem do powłoki lub w kolejnej sesji z Bash. Odnotowuję to jako rzecz do zamknięcia, nie zgaduję dalej.
2. **Mechanizm print: portal + `dangerouslySetInnerHTML` zamiast iframe.** Plan rekomendował ogólnie "print stylesheet ukrywający UI, pokazujący tylko CVPreview/wybrany layout" bez rozstrzygania szczegółu implementacji. Rozważono i odrzucono: (a) drukowanie zawartości iframe podglądu bezpośrednio — niespójne między przeglądarkami (część przeglądarek nie włącza contentu iframe do wydruku strony nadrzędnej bez dodatkowych sztuczek), (b) trzymanie CV jako zwykłego JSX renderowanego warunkowo w drzewie komponentu — wymagałoby przepisania `buildCVFragment` na JSX (większa zmiana, więcej ryzyka regresji wizualnej vs HTML string który już był przetestowany w produkcji jako generator PDF). Wybrano portal do `document.body` + `dangerouslySetInnerHTml` z istniejącego HTML stringa — najmniejsza zmiana, reużywa całą sprawdzoną logikę renderowania CV.
3. **3 layouty zachowane** (nie uproszczono do jednego) — zgodnie z warunkiem z zadania (próg ~150 linii nieprzekroczony).
4. **Nie zatrzymano się na "dark vs light PDF"** (Globalne miejsce zatrzymania #5 w planie) — bo to pytanie było już rozstrzygnięte przez ISTNIEJĄCY kod (`build_html`/`buildPreviewHtml` renderowały jasne PDF od zawsze, w obu wersjach — starej server-side i obecnej client-side), nie była to nowa decyzja podejmowana w tej sesji tylko kontynuacja istniejącego zachowania. Odnotowuję to wprost, żeby główna sesja/user mogli to zweryfikować i ewentualnie zakwestionować, skoro plan explicite prosił o potwierdzenie.

### Do zweryfikowania przez reviewer/test-writer (nie wykonane w tej sesji — brak dostępu do przeglądarki/Bash)
- **Realne działanie `window.print()` w przeglądarce**: czy dialog drukowania faktycznie pokazuje TYLKO CV (a nie całą stronę) — logika CSS/portal wygląda poprawnie na papierze, ale nieprzetestowana renderowo w tej sesji.
- **`dangerouslySetInnerHTML` + `id="pdf-print-root"` duplikacja przy Fast Refresh / wielokrotnym mouncie** — niskie ryzyko, ale niesprawdzone.
- **`npm run build`/`npm run lint`** — nieuruchomione (brak Bash). `cssStringToObject` w `PdfExportSection.tsx` zwraca teraz `React.CSSProperties` (rzutowanie jawne `as React.CSSProperties` na wewnętrzny `Record<string,string>`) zamiast zwracać `Record<string,string>` wprost — naprawione w tej samej sesji po zauważeniu niezgodności typu przy spreadzie `style={{ display:"none", ...cssStringToObject(...) }}`. Nieprzepuszczone przez faktyczny `tsc`/`next build` — zalecana kompilacja przed merge dla pewności.
- Fizyczne usunięcie `backend/pdf_templates.py` (patrz decyzja #1 wyżej).
- Weryfikacja, że `backend/routes/pdf.py` importuje `re` i faktycznie go używa (tak, w `_clean_cv_text`) — sprawdzone statycznie, niesprawdzone uruchomieniem testów (brak Bash).

---

## Faza 3 — wykonane zmiany (coder + główna sesja)

Uwaga procesowa: coder wyczerpał limit sesji tuż przed dopisaniem tej sekcji — spisane przez główną sesję na podstawie stanu plików i wyników build.

### Nowe pliki
- `frontend/lib/hooks/useApplications.ts` — wspólny hook CRUD listy aplikacji: fetch (inline w efekcie, setState tylko w callbackach async), optimistic update statusu z rollbackiem, delete z rollbackiem, `actionError`, `refetch`.
- `frontend/lib/kanban.ts` — stałe kolumn (KANBAN_COLUMNS) i pomocnicze typy.
- `frontend/lib/dashboard.ts` — agregacje danych dashboardu (m.in. buildWeeklyCounts, typ WeekPoint).
- `frontend/components/kanban/KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanCard.tsx`, `KanbanCardGhost.tsx` — board 4 kolumny (Applied/Interview/Offer/Rejected) na @dnd-kit; drag&drop zmienia status przez PATCH (optimistic+rollback); ghost-karta z CTA w pustych kolumnach; mobile: poziomy scroll kolumn, long-press TouchSensor, tap-fallback na badge statusu.
- `frontend/components/dashboard/NarrativeHeader.tsx` + `NumberMarker.tsx` — narracyjny nagłówek z liczbami wyróżnionymi neonowym markerem.
- `frontend/components/dashboard/ConversionFunnel.tsx` — dominujący funnel Applied→Interview→Offer + osobny pasek rejected.
- `frontend/components/dashboard/ActivityLedger.tsx` — chronologiczny rejestr zdarzeń z created_at/updated_at (bez wymyślonego event-logu).
- `frontend/components/dashboard/WeeklySparkline.tsx` — sparkline tygodni (recharts, bez osi) zamiast dużego bar chartu.
- `frontend/components/EmptyState.tsx` — współdzielony empty state z ikoną i CTA.
- `frontend/components/AnimatedScore.tsx` — animacja zmiany score + chip delty (+N ▲ / −N ▼), wpięty w MatchScore.

### Zmienione
- `frontend/app/applications/page.tsx` — tabela zastąpiona KanbanBoard; loading skeleton w układzie kolumn; empty state z CTA.
- `frontend/app/dashboard/page.tsx` — usunięty grid 4 stat-cardów; nowy układ: NarrativeHeader → WeeklySparkline → ConversionFunnel → ActivityLedger → HeatmapGrid; empty state z CTA.
- `frontend/components/MatchScore.tsx`, `ReviewResult.tsx` — użycie AnimatedScore.

### Poprawki głównej sesji (build initially failed)
1. `WeeklySparkline.tsx` — usunięty identity `labelFormatter`, `formatter` bez jawnej (zbyt wąskiej) anotacji — typy recharts 3 są szersze (ValueType/NameType), strict TS odrzucał `(label: string)`.
2. Nowa reguła `react-hooks/set-state-in-effect` (ESLint w Next 16) blokowała build w 3 miejscach — wzorce naprawcze:
   - fetch-on-mount: NIE wywoływać w efekcie funkcji robiącej synchroniczne setState; inline `getApplications().then/.catch/.finally` + flaga `cancelled` (dashboard/page.tsx, useApplications.ts),
   - wykrycie mountu pod portal: zamiast `useState+useEffect(setMounted)` → `useSyncExternalStore(noopSubscribe, () => true, () => false)` (PdfExportSection.tsx).
3. Weryfikacja: `npm run lint` + `npm run build` czyste (exit 0).

---

## Fazy 5-6 — wykonane zmiany (coder)

Zakres: historia analiz per aplikacja + wykres progresji score (Faza 5) i persystencja `cv-context` do `sessionStorage` (Faza 6).

### 5A — Backend: tabela `analyses` + endpointy

**`backend/database.py`**
- `create_pool()`: dodano `ALTER TABLE applications ADD COLUMN IF NOT EXISTS job_description TEXT` (idempotentne, bezpieczne na współdzielonej bazie) oraz `CREATE TABLE IF NOT EXISTS analyses(...)` z `application_id UUID ... REFERENCES applications(id) ON DELETE CASCADE`, `overall_score INT`, `missing_keywords JSONB DEFAULT '[]'`, `categories JSONB DEFAULT '[]'`, `created_at TIMESTAMPTZ DEFAULT NOW()`. Wykonywane przy starcie serwera, spójnie z istniejącym wzorcem `applications`. Brak `DROP`/zmian typu — zgodnie z zasadą "baza współdzielona, brak destrukcyjnych migracji".

**`backend/models.py`**
- `ApplicationCreate`: dodano `missing_keywords: Optional[List[str]]`, `categories: Optional[List[MatchCategory]]` (reużyty istniejący `MatchCategory` z `/analyse`, zero duplikacji modelu kategorii).
- `ApplicationOut`: dodano `job_description: Optional[str] = None`.
- Nowe modele: `ReanalyseRequest` (`cv: str`, `job_description: Optional[str] = None` — nadpisanie opcjonalne, domyślnie bierzemy z zapisanej aplikacji), `AnalysisOut` (`id, application_id, overall_score, missing_keywords, categories, created_at`).

**`backend/routes/applications.py`** (przepisany kompletnie)
- `GET /applications/{id}` — nowy endpoint, pojedyncza aplikacja, 404 jeśli brak.
- `POST /applications/` — rozszerzony: insert aplikacji + `job_description`; jeśli `match_score is not None`, w tej samej transakcji (`conn.transaction()`) insertuje też pierwszy wiersz do `analyses` (missing_keywords/categories jako JSON, serializowane ręcznie przez `json.dumps` — asyncpg nie ma skonfigurowanego codec dla JSONB w tym projekcie, więc serializacja/deserializacja jest jawna w routes, nie w warstwie połączenia).
- `GET /applications/{id}/analyses` — lista chronologiczna rosnąco (`ORDER BY created_at ASC`), 404 jeśli aplikacja nie istnieje.
- `POST /applications/{id}/analyses` — re-analiza: 400 jeśli CV < 50 znaków; pobiera `job_description` z zapisanej aplikacji (chyba że request go nadpisuje), 400 jeśli go brak lub jest za krótki; woła `clean_cv_text_ai` → `analyse_cv` (ten sam pipeline co `/analyse/`, dla spójności czyszczenia CV); w transakcji insertuje nowy wiersz `analyses` I aktualizuje `applications.match_score` + `updated_at`; zwraca `AnalysisOut`.
- Kolejność tras `/{app_id}` vs `/{app_id}/analyses` nie koliduje (różna liczba segmentów URL) — sprawdzone.

### 5B — Frontend: `lib/api.ts`, SaveApplicationModal, `/applications/[id]`

**`frontend/lib/api.ts`**
- `Application`: dodano `job_description: string | null`.
- Nowy typ `Analysis` (`id, application_id, overall_score, missing_keywords, categories, created_at`).
- `getApplication(id)`, `getAnalyses(applicationId)`, `reanalyseApplication(applicationId, cv)` — nowe funkcje.
- `createApplication(...)`: sygnatura rozszerzona o `job_description?`, `missing_keywords?`, `categories?`.

**`frontend/components/SaveApplicationModal.tsx`**
- Nowe propsy `jobDescription?`, `missingKeywords?`, `categories?`, przekazywane do `createApplication(...)` — naprawia opisany w planie bug ("frontend nie wysyłał job_description").

**`frontend/app/analyse/page.tsx`**
- Wywołanie `<SaveApplicationModal>` rozszerzone o `jobDescription={jobDescription}`, `missingKeywords={analyseResult?.missing_keywords}`, `categories={analyseResult?.categories}`.
- **Uwaga/ograniczenie zakresu**: plan wspominał też `/review/page.tsx`, ale `SaveApplicationModal` jest używany tylko w `/analyse` (review nie ma "job description" do zapisania — to inny przepływ, ocena CV bez konkretnego ogłoszenia) — nie dotykane, brak takiego wywołania w review.

**Nowa strona `frontend/app/applications/[id]/page.tsx`**
- Client Component (`"use client"`), `params: Promise<{ id: string }>`, odczyt przez `use(params)` z Reacta — wzorzec potwierdzony w `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`, sekcja "Reading `searchParams` and `params` in Client Components": `'use client'` + `import { use } from "react"` + `const { slug } = use(params)`. Wybrany zamiast `async function Page` (Server Component), bo strona potrzebuje `useCVContext()` (hook, wymaga client boundary) do prefillu CV w panelu re-analizy.
- Fetch `getApplication(id)` + `getAnalyses(id)` równolegle (`Promise.all`) w `useEffect` z `[id]` w deps; `setState` wyłącznie w async callbackach `.then/.catch/.finally` z flagą `cancelled` — dokładnie wzorzec z `useApplications.ts`/`dashboard/page.tsx` (react-hooks/set-state-in-effect). Świadomie NIE resetowano `setLoading(true)`/`setError(null)` synchronicznie na początku efektu (naruszałoby regułę) — przy pierwszym mouncie initial state (`loading=true`, `error=null`) już jest poprawny; re-run efektu przy zmianie `id` w praktyce nie występuje w obecnym flow (brak nawigacji między różnymi `[id]` bez pełnego mountu strony), odnotowuję to jako świadome uproszczenie.
- Loading: skeleton. Error/not-found: `EmptyState` z CTA powrotu do `/applications`.
- `handleAnalysed(analysis)`: po sukcesie re-analizy dopisuje nowy rekord do lokalnej listy `analyses` (bez pełnego refetchu) i aktualizuje `application.match_score` — to zasila zarówno wykres progresji, jak i `AnimatedScore` w nagłówku (delta animuje się automatycznie, bo `AnimatedScore` trzyma poprzednią wartość w `useRef`).

**Nowe komponenty `frontend/components/application-detail/*`** (wszystkie ≤ 100 linii)
- `AppDetailHeader.tsx` — link powrotny, status badge (kolor z `COLUMN_ACCENT`), firma/rola/data, `AnimatedScore` bieżącego wyniku.
- `ScoreProgressChart.tsx` — recharts `LineChart`, oś X = data analizy (sformatowana), oś Y = 0–100; jeśli < 2 punkty, komunikat "Not enough data yet" zamiast pustego wykresu (backend już zwraca listę posortowaną rosnąco, więc oś X jest chronologiczna bez dodatkowego sortowania po stronie frontu).
- `AnalysisList.tsx` — lista analiz najnowsze-najpierw (`[...analyses].reverse()`), data + score chip + tagi missing keywords.
- `ReanalysePanel.tsx` — textarea prefillowana z `initialCv` (przekazywane z `cvText` z `useCVContext()` w stronie nadrzędnej), walidacja min. 50 znaków, `reanalyseApplication(id, cv)`, loading/error, `console.error` w catch.

**`frontend/components/kanban/KanbanCard.tsx`**
- Nazwa firmy zamieniona z `<span>` na `<Link href="/applications/{id}">` z `onPointerDown={(e) => e.stopPropagation()}` — zapobiega temu, żeby kliknięcie w link inicjowało drag przez `@dnd-kit` `PointerSensor` (który nasłuchuje na `pointerdown` na całej karcie). Reszta karty (status badge, delete) pozostaje bez zmian — drag handle to nadal cała karta poza linkiem i przyciskami.

### 5C — Mock backend (scratchpad `mock_api.py`)

Rozszerzony o identyczne kontrakty co backend:
- Seedy `APPS` dostały `job_description` (wspólny `SAMPLE_JD`, żeby re-analiza miała względem czego liczyć wynik).
- Nowa lista `ANALYSES` (in-memory) + `_seed_analysis(...)` — 3 historyczne wpisy dla pierwszej aplikacji (Netguru, score 58→65→72) i 2 dla drugiej (Allegro, 70→84), żeby `/applications/[id]` miało od razu co wykreślić bez konieczności klikania re-analizy.
- `GET /applications/{app_id}` — nowy.
- `POST /applications/` — jeśli `match_score is not None`, dopisuje pierwszy wiersz do `ANALYSES` (spójnie z backendem).
- `DELETE /applications/{app_id}` — dodatkowo czyści powiązane wpisy z `ANALYSES` (odpowiednik `ON DELETE CASCADE`).
- `GET /applications/{app_id}/analyses` — zwraca historię posortowaną po `created_at`.
- `POST /applications/{app_id}/analyses` — `asyncio.sleep(AI_DELAY)`, podnosi wynik o +6 względem ostatniego znanego `match_score` (capped na 99), zwraca nowy `AnalysisOut`-owy dict i aktualizuje `APPS` — pozwala zobaczyć animację delty (`AnimatedScore`) i nowy punkt na wykresie bez podpiętego realnego Anthropic API.

### FAZA 6 — Persystencja `cv-context` do sessionStorage

**`frontend/lib/cv-context.tsx`**
- Klucz `hireworthy:cv-context`. Zapisywany stan: `cvText`, `reviewResult`, `analyseResult`, `jobDescription` (bez `resultIsStale` — to pochodna, wyliczana przy hydracji).
- **Odczyt (hydracja)**: `useEffect(() => { ... }, [])` na mount, ale faktyczny `sessionStorage.getItem` + `setState` dzieje się wewnątrz `Promise.resolve().then(...)` — a więc w asynchronicznym callbacku, nie synchronicznie w ciele efektu. To była **jednoznaczna decyzja koordynatora w trakcie sesji** (nie `useSyncExternalStore`, żeby uniknąć większego refaktoru) — wzorzec: `useEffect` planuje mikrotask, mikrotask robi `sessionStorage.getItem`, `JSON.parse`, walidację kształtu (`isPersistedState` type guard, żeby uniknąć `any`/rzutowań bez sprawdzenia) i `setState` na czterech polach + `resultIsStale` (ustawiane na `true` tylko jeśli odtworzony `analyseResult`/`reviewResult` nie jest `null` — tzn. wracamy z wynikiem, więc banner "Showing previous results" ma się pokazać, zgodnie z bugiem 5 / mechanizmem z Fazy 1).
- **Guard `didHydrate` (`useRef`)**: zapobiega temu, żeby pierwszy render (pusty stan, wymagany do zgodności z SSR i braku hydration mismatch — strony są prerenderowane, `sessionStorage` nie istnieje na serwerze) natychmiast nadpisał to, co dopiero zostanie odczytane z storage. Efekt zapisujący (`useEffect` z deps `[cvText, reviewResult, analyseResult, jobDescription]`) sprawdza `didHydrate.current` na wejściu i nic nie robi, dopóki odczyt się nie zakończy.
- **Zapis**: osobny `useEffect`, `sessionStorage.setItem(...)` przy każdej zmianie ww. czterech pól — to nie jest `setState`, więc reguła `react-hooks/set-state-in-effect` go nie dotyczy (`write do storage w efekcie jest legalny`).
- `clearAll()`: dodatkowo woła `sessionStorage.removeItem(STORAGE_KEY)`.
- **sessionStorage, nie localStorage** — świadomie, zgodnie z planem (dane sesyjne, przeżywają F5, znikają po zamknięciu karty).
- **Znana drobna redundancja**: `analyse/page.tsx` i `review/page.tsx` mają już własną logikę `markResultStale()` na mount (guard `didMount` ref, z Fazy 1) niezależną od hydracji kontekstu. Jeśli hydracja z sessionStorage też ustawi `resultIsStale = true` (bo odtworzyła niepusty wynik), obie ścieżki mogą wywołać `markResultStale()` — nieszkodliwe (idempotentne, `true` ustawione dwukrotnie), ale odnotowuję to jako duplikację logiki do ewentualnego uproszczenia w przyszłości (poza zakresem tej sesji, nie naprawiane bez zgody, zgodnie z zasadą "nie wprowadzaj zmian poza zakresem planu").

### Nie zweryfikowane w tej sesji (brak dostępu do Bash/przeglądarki w roli coder)
- `npm run build` / `npm run lint` / `pytest backend/tests` — nieuruchomione. Zalecane przed merge, szczególnie:
  - `backend/routes/applications.py`: `_analysis_row_to_out` zakłada, że asyncpg zwraca kolumny JSONB albo jako `str` (surowy JSON), albo już zdekodowane — obsłużone przez `isinstance(row["missing_keywords"], str)`, ale niesprawdzone na realnym Postgresie (brak DATABASE_URL w tym środowisku).
  - `frontend/app/applications/[id]/page.tsx`: `use(params)` w Client Component — wzorzec potwierdzony w docs, ale niesprawdzony faktycznym `next build`/`next typegen` w tym repo (Next 16, generowane globalne typy `PageProps` — nie użyto `PageProps<'/applications/[id]'>` helpera z docs, tylko jawny `params: Promise<{id: string}>`; oba są poprawne wg docs, jawny typ wybrany dla czytelności bez zależności od wygenerowanych typów).
  - `recharts` `Tooltip formatter` w `ScoreProgressChart.tsx` — zastosowano wzorzec bez jawnej wąskiej adnotacji typu na `value` (naprawka z Fazy 3 dla `WeeklySparkline.tsx`), ale niesprawdzone kompilacją.
- Realne działanie re-analizy na mocku (asyncio.sleep + wzrost score) — logika napisana zgodnie ze specyfikacją, nieuruchomiona w przeglądarce w tej sesji.
- `docs/agent-runs/2026-07-02-redesign-audyt-plan.md` wspominał opcjonalnie dorobienie `/review/page.tsx` do wysyłki wyniku — pominięte świadomie (patrz wyżej, review nie ma job_description/aplikacji do zapisania w tym flow).

---

## Przegląd kodu (reviewer)

Zakres: pełny przegląd statyczny plików Faz 1–6 (backend routes/models/database/pdf, frontend lib/komponenty/strony, mock ze scratchpada). Weryfikacja runtime happy-paths była już wykonana przez główną sesję — poniżej wyłącznie to, czego smoke-test nie łapie. Nic nie naprawiałem (rola czytelnik-reporter).

Pozytywy warte odnotowania: XSS w print-portalu jest realnie obsłużony (`escape()` na każdej linii CV, kolory walidowane regexem, wstrzyknięcia wyłącznie w pozycjach treści elementów — patrz ISTOTNY-7 co do kruchości); parametryzacja SQL w asyncpg konsekwentna (zero interpolacji stringów, `$1/$2` wszędzie); transakcja przy `POST /applications/` z analizą poprawnie obejmuje oba INSERT-y; `ON DELETE CASCADE` + odpowiednik w mocku spójne; grep: zero `any`, zero `console.log`, zero `fetch()` poza `lib/api.ts`; `backend/pdf_templates.py` jest już fizycznie usunięty (punkt otwarty z Fazy 4 — zamknięty); iframe'y podglądu mają `sandbox=""`.

### KRYTYCZNY

**K1. SaveApplicationModal: po udanym zapisie `saving` zostaje `true` na zawsze — drugi zapis w tej samej sesji widoku jest zablokowany.**
`frontend/components/SaveApplicationModal.tsx:27-44` — `handleSave` ustawia `setSaving(true)`, ale `setSaving(false)` jest wywoływane tylko w gałęzi `catch`. Po sukcesie woła `onSaved()` (rodzic zamyka modal), a stan `saving=true` zostaje w komponencie — modal jest renderowany bezwarunkowo w `analyse/page.tsx:296-304` (steruje nim prop `open`), więc komponent nie odmontowuje się i stan nie resetuje.
Scenariusz: /analyse → analiza → "Save Application" → zapis OK → "CLEAR" → nowa analiza → "Save Application" → modal otwiera się z przyciskami **Cancel i Save trwale wyłączonymi** ("Saving…"). Użytkownik nie może zapisać drugiej aplikacji bez nawigacji poza stronę (remount). Dodatkowo pola `company`/`role` trzymają wartości z poprzedniego zapisu.
Fix (dla głównej sesji): `finally { setSaving(false) }` + reset pól przy otwarciu/zamknięciu.

### ISTOTNY

**I1. useApplications.updateStatus: stale closure na `applications` + brak ochrony przed out-of-order odpowiedziami PATCH.**
`frontend/lib/hooks/useApplications.ts:56-70` — `previous` jest czytane z `applications` z domknięcia (deps `[applications]` odświeżają callback dopiero po re-renderze), a po sukcesie stan jest nadpisywany odpowiedzią serwera przez `map(... ? updated : a)`.
Scenariusz: szybkie dwa przeciągnięcia tej samej karty (applied→interview, zaraz potem interview→offer). (a) Drugie wywołanie może dostać callback sprzed re-rendera → `previous` wskazuje stary status i ewentualny rollback cofa kartę do złej kolumny; (b) jeśli odpowiedź pierwszego PATCH przyjdzie PO optimistic updacie drugiego, `updated` (status=interview) nadpisze optimistic "offer" — karta wizualnie cofa się do złej kolumny do czasu odpowiedzi drugiego PATCH, a przy odwróconej kolejności odpowiedzi UI zostaje trwale rozjechane z serwerem do refetchu. Bez utraty danych na serwerze, ale UI kłamie.
Kierunek: brać `previous` wewnątrz funkcyjnego `setApplications`, ignorować odpowiedź PATCH jeśli w międzyczasie był nowszy lokalny update tej samej karty (licznik/wersja per id), albo po prostu nie nadpisywać stanu odpowiedzią (optimistic już jest poprawny).

**I2. useApplications.removeApplication: rollback przywraca CAŁĄ tablicę ze snapshotu — kasuje równoległe zmiany.**
`frontend/lib/hooks/useApplications.ts:72-83` — `const previous = applications` (snapshot z domknięcia), przy błędzie `setApplications(previous)`.
Scenariusz: użytkownik przeciąga kartę A (optimistic update w toku), po czym usuwa kartę B, DELETE się nie udaje → rollback przywraca tablicę sprzed OBU operacji — status karty A wizualnie cofa się mimo że jej PATCH się powiódł. Analogicznie dwa szybkie delete: fail drugiego wskrzesza pierwszą usuniętą kartę.
Kierunek: rollback punktowy — wstawić z powrotem tylko usuniętą kartę (`setApplications(prev => [...prev, removed])` z zachowaniem sortowania), nie cały snapshot.

**I3. cv-context: walidacja odczytu z sessionStorage nie sprawdza kształtu wyników — uszkodzony/stary zapis wywala strony wyników.**
`frontend/lib/cv-context.tsx:15-19` + `:68-76` — `isPersistedState` sprawdza tylko `cvText`/`jobDescription` jako stringi. `reviewResult`/`analyseResult` trafiają do stanu bez żadnej walidacji: (a) wpis bez tych kluczy → `setReviewResult(undefined)` — strażnicy renderowania używają `!== null`, więc `undefined` przechodzi i `ReviewResult`/`MatchScore` dostają `undefined` → crash na `result.categories.map`; dodatkowo `parsed.analyseResult !== null` jest true dla `undefined` → banner "previous results" bez wyniku; (b) wpis ze starym schematem (np. sprzed zmiany kształtu `AnalyseResult`) → crash na brakującym polu. To realny scenariusz przy każdej przyszłej zmianie kształtu wyników między deployami (sessionStorage przeżywa deploy w otwartej karcie).
Kierunek: walidować obecność i typ kluczowych pól wyników (albo wersjonować klucz storage), przy niezgodności — odrzucić wpis w całości.

**I4. Backend: nieprawidłowy UUID w ścieżce → 500 zamiast 404/422 (wszystkie endpointy z `{app_id}`).**
`backend/routes/applications.py:59,104,129,138,155` — `app_id: str` jest przekazywany do `WHERE id = $1` na kolumnie UUID; asyncpg przy nie-UUID-owym stringu rzuca `DataError`/`InvalidTextRepresentationError`, nieobsłużone → 500.
Scenariusz: `GET /applications/foo` (ręczny URL, stary link, literówka) → 500 + stack trace w logach; frontend detail page pokaże surowy komunikat błędu zamiast "Application Not Found". Mock tego nie łapie (porównuje stringi, zwraca 404) — kolejna rozbieżność kontraktu mock↔backend.
Kierunek: `app_id: UUID` w sygnaturach (FastAPI zwróci 422) albo try/except na konwersji → 404.

**I5. Backend: `ApplicationCreate.match_score` bez ograniczeń 0–100, a `AnalysisOut.overall_score` ma `ge=0, le=100` — można trwale zepsuć `GET /analyses`.**
`backend/models.py:71` (brak Field(ge/le)) vs `:103`. `POST /applications/` z `match_score: 150` przechodzi, insertuje wiersz do `analyses` z `overall_score=150`; od tej pory `GET /applications/{id}/analyses` **zawsze** zwraca 500 (walidacja response_model odrzuca zapisany wiersz). Zatruty rekord = trwale niedziałający widok szczegółu aplikacji. To samo dotyczy ujemnych wartości.
Kierunek: `match_score: Optional[int] = Field(None, ge=0, le=100)` w `ApplicationCreate` (i analogiczna weryfikacja w `_analysis_row_to_out` dla danych zastanych).

**I6. Backend: re-analiza trzyma połączenie z puli przez cały czas wywołania Claude.**
`backend/routes/applications.py:154-190` — `clean_cv_text_ai` + `analyse_cv` (dwa wywołania AI, realnie kilkanaście–kilkadziesiąt sekund) wykonują się WEWNĄTRZ `async with pool.acquire()`. Pula ma `max_size=10` (`database.py:12`).
Scenariusz: 10 równoległych re-analiz = pula wyczerpana; każdy inny request do bazy (lista aplikacji, dashboard) wisi do zwolnienia połączenia. Kierunek: acquire → SELECT → release; wywołania AI poza połączeniem; drugi acquire na INSERT/UPDATE (z ponownym sprawdzeniem istnienia aplikacji).

**I7. Print-portal: `dangerouslySetInnerHTML` poza sandboxem — dziś bezpieczne, ale niezgodne z regułą projektu i kruche.**
`frontend/components/PdfExportSection.tsx:164-175` + `frontend/components/CVPreview.tsx:5-7`. Reguła projektu: żadnego `dangerouslySetInnerHTML` poza sandboxowanym iframe — portal renderuje HTML z CV użytkownika wprost do `document.body`. Audyt NIE wykazał działającego wektora XSS: każdy fragment tekstu przechodzi przez `escape()` (`&`,`<`,`>`), kolory przez `safeColor()` regex, wstrzyknięcia wyłącznie w treści elementów. ALE: `escape()` nie escapuje cudzysłowów (`"`/`'`) — jest bezpieczny tylko dopóki żaden przyszły edit nie wstawi tekstu użytkownika do atrybutu HTML (`title="..."`, `style="..."`). Jedna nieuważna zmiana w `buildCVFragment` = XSS w głównym dokumencie (bez sandboxa).
Kierunek: dodać `"` i `'` do `escape()` (tanie), a docelowo rozważyć render fragmentu jako JSX (eliminuje klasę problemu) — do decyzji użytkownika.

**I8. Globalny `@media print` czyni WYDRUK KAŻDEJ INNEJ STRONY pustą kartką.**
`frontend/app/globals.css:256-273` — `body > *:not(#pdf-print-root) { display:none !important }` obowiązuje globalnie, a `#pdf-print-root` istnieje tylko, gdy na stronie jest zamontowany `PdfExportSection` (czyli wyłącznie po tailorze na /analyse lub /review — `TailorSection.tsx:145`).
Scenariusz: Ctrl+P na dashboardzie/aplikacjach/landingu → pusta strona w podglądzie wydruku. Cicha regresja natywnej funkcji przeglądarki na całej aplikacji.
Kierunek: aktywować regułę warunkowo, np. `body:has(#pdf-print-root) > *:not(#pdf-print-root)` (`:has()` już jest używane w tym pliku dla scrima) — wtedy strony bez portalu drukują się normalnie.

**I9. KanbanCard: `touch-none` na całej karcie blokuje scroll na mobile.**
`frontend/components/kanban/KanbanCard.tsx:38` — `touch-action: none` na każdej karcie wyłącza natywne przewijanie, gdy dotyk zaczyna się na karcie (a `TouchSensor` z delay 250ms i tak przejmuje drag dopiero po przytrzymaniu). Na mobile kolumna 80vw wypełniona kartami = duża część ekranu, od której nie da się rozpocząć przewijania pionowego strony ani poziomej karuzeli.
Kierunek: `touch-action: manipulation` (lub `pan-y`) zamiast `none` — dnd-kit z TouchSensor+delay tego wystarcza; przetestować drag po zmianie.

### DROBNY

**D1.** `backend/routes/applications.py:100-122` — PATCH robi read-modify-write bez transakcji/`FOR UPDATE`: dwa równoległe PATCH-e (status + notes) mogą się wzajemnie nadpisać stalym odczytem; ponadto jeśli aplikacja zostanie usunięta między SELECT a UPDATE, `fetchrow` zwróci `None` → `_row_to_out(None)` → TypeError → 500. Mało prawdopodobne przy jednym użytkowniku, ale baza jest współdzielona.

**D2.** `backend/routes/applications.py:170` — `detail=f"Analysis failed: {str(e)}"` wypuszcza treść wewnętrznego wyjątku (w tym potencjalnie komunikaty SDK Anthropic) do klienta. Lepiej logować, zwracać komunikat generyczny.

**D3.** `backend/models.py:95-97` — `ReanalyseRequest.cv` bez górnego limitu długości (koszt wywołania Claude przy wklejeniu megabajtów); walidacja `>= 50` znaków jest ręczna w routingu zamiast w modelu (`Field(min_length=50)` byłoby spójniejsze z konwencją Pydantic-first).

**D4.** Rozbieżności mock↔backend (scratchpad `mock_api.py`): (a) `create_app_` woła `_now()` osobno dla `created_at` i `updated_at` → mikrosekundowa różnica → `buildLedger` pokazuje "→ applied" zamiast "saved" dla świeżo dodanych wpisów — fałszuje audyt runtime dashboardu; (b) mock nie zwraca `user_id` (backend zwraca — frontend ignoruje, ale kontrakt niepełny); (c) mock nadal wystawia usunięty `/pdf/generate`; (d) mock PATCH przyjmuje dowolny string statusu (backend: 422 od enuma); (e) mock reanalyse sprawdza `len(req.cv)` bez `.strip()` i po sprawdzeniu 404 (backend: strip, przed 404) — inne statusy dla tych samych wejść brzegowych; (f) nieprawidłowy UUID: mock 404, backend 500 (patrz I4).

**D5.** `frontend/lib/dashboard.ts:68-73` + `frontend/app/dashboard/page.tsx:36` — mieszanie lokalnej daty (`getDay`/`setDate`) z `toISOString()` (UTC): dla stref na wschód od UTC aplikacja dodana tuż po północy lokalnie może trafić do poprzedniego dnia/tygodnia (klucz heatmapy i tygodnia przesunięty o 1). Off-by-one widoczny tylko przy datach blisko północy.

**D6.** `frontend/lib/dashboard.ts:81-90` — `buildWeeklyCounts` nie uzupełnia pustych tygodni zerami; sparkline łączy linią tygodnie niesąsiadujące (np. 5 aplikacji, potem 3 tygodnie przerwy, potem 4 — wykres sugeruje ciągłość).

**D7.** `frontend/components/dashboard/NarrativeHeader.tsx:26` — przy zero aplikacjach ze score `averageScore` zwraca 0 i nagłówek twierdzi "Average match 0%" (mylące: brak danych ≠ 0%). Przy 0 aplikacji w tym tygodniu tekst "0 applications this week." jest poprawny gramatycznie — OK.

**D8.** `frontend/lib/cv-context.tsx:91-98` — `clearAll()` robi `removeItem`, po czym efekt persist (stan się zmienił, `didHydrate=true`) natychmiast zapisuje pusty stan z powrotem — klucz nie znika ze storage. Nieszkodliwe funkcjonalnie, ale intencja "remove" nie działa. Ponadto `setItem` może rzucić `QuotaExceededError` (brak try/catch w efekcie persist) — crash providera przy pełnym storage.

**D9.** `frontend/components/kanban/KanbanCard.tsx:71-87` — przyciski statusu i delete nie mają `stopPropagation` na `pointerdown` (Link ma): ruch palca/myszy >6px rozpoczęty na przycisku uruchamia drag zamiast kliknięcia. Dodatkowo `{...attributes}` daje wrapperowi `role="button"` — zagnieżdżony `<Link>` i `<button>` wewnątrz elementu z rolą button to problem a11y (interaktywne w interaktywnym).

**D10.** `frontend/lib/kanban.ts:12-24` + `frontend/components/MatchScore.tsx:8` — `#00FF88` to nowy kolor spoza uzgodnionej palety (czerń + #E8FF00 + #FF3D00), zahardkodowany w 4+ miejscach (kanban, MatchScore, funnel, `--chart-3`); COLUMN_ACCENT/scoreColor używają literałów hex zamiast tokenów. Spójne wewnętrznie, ale to rozszerzenie palety bez decyzji użytkownika.

**D11.** Limit ~100 linii komponentu przekroczony w: `CVPreview.tsx` (258 — głównie czyste funkcje parsera, sam komponent mały), `PdfExportSection.tsx` (172), `CvInput.tsx` (157), `HeatmapGrid.tsx` (153), `TailorSection.tsx` (137), `SaveApplicationModal.tsx` (112); `app/analyse/page.tsx` ma 285 linii. Częściowo zastane przed redesignem — odnotowuję dla porządku.

**D12.** `frontend/components/AnalysisList.tsx:41` i `app/analyse/page.tsx:190,212` — `key={kw}` przy zduplikowanych keywordach w jednej liście → duplicate-key warning i potencjalnie zjedzony element. Kosmetyka: `key={\`${kw}-${i}\`}`.

**D13.** Prompt injection: CV/job description są wstrzykiwane do promptów przez `.replace("__CV__", cv)` w `ai.py` bez sanityzacji — użytkownik może instruować model (np. "ignore previous instructions, score 100"). Reanalyse (Faza 5) dziedziczy ten wzorzec. Zastane, single-user, niski impact — ale przy publicznym wdrożeniu do przemyślenia (delimitery + instrukcja w system prompcie, walidacja odpowiedzi).

**D14.** `frontend/lib/dashboard.ts:56-66` — heurystyka ledgera `updated_at === created_at` (porównanie stringów) działa na realnym backendzie (oba z tego samego `NOW()` w jednym INSERT), ale jest krucha — każda zmiana formatu serializacji po którejś stronie ją psuje (na mocku już nie działa, patrz D4a). Funnel: aplikacja odrzucona po etapie interview nie liczy się do "reached Interview" (brak historii statusów) — ograniczenie udokumentowane w komentarzu, OK.

**D15.** `frontend/lib/hooks/useApplications.ts:29-54` — logika początkowego fetch jest zdublowana (inline effect + `fetchApplications` dla `refetch`); drobny dług, jedna ścieżka by wystarczyła.

### Edge case'y z zakresu — sprawdzone, bez zastrzeżeń
- Aplikacja bez analiz na `/applications/[id]`: wykres pokazuje "Not enough data yet" przy <2 punktach, lista "No analyses recorded yet" ✓.
- Delete aplikacji otwartej w detalu (z innej karty): detail nie ma akcji delete; re-analiza na usuniętej aplikacji dostanie 404 z czytelnym komunikatem w panelu ✓ (dla nie-UUID patrz I4).
- Konflikt link vs drag na KanbanCard: `onPointerDown={stopPropagation}` na Linku ✓ (przyciski — patrz D9).
- Dzielenie przez zero: funnel (`stages[i-1].count === 0 ? 0`), rejected% (`total = length || 1`), averageScore (guard na 0) ✓.
- Kolejność tras `/{app_id}` vs `/{app_id}/analyses` — brak kolizji ✓; statusy lowercase spójne front↔backend↔mock ✓; obsługa 204 w `request()` ✓; kształt błędu `{detail}` spójny ✓.
- Hydracja sessionStorage vs `markResultStale`: kolejność efektów (strona przed providerem) + mikrotask powodują, że obie ścieżki zbiegają do poprawnego stanu banera; duplikacja logiki odnotowana już przez codera, idempotentna ✓.

---

## Testy (test-writer)

### Zakres pokrycia

Napisane testy backendu w pytest obejmują:
1. **Model validation (Pydantic)**: ApplicationCreate, ApplicationUpdate, ApplicationStatus, AnalysisOut, AnalyseResponse, ReanalyseRequest, MatchCategory — granice wartości (0–100 dla score), typy, pola wymagane/opcjonalne.
2. **Faza 5 — nowe endpointy**: GET /applications/{id}, POST /applications/ (z analiza w transakcji), GET /applications/{id}/analyses (porządek chronologiczny), POST /applications/{id}/analyses (walidacja CV, fallback job_description, aktualizacja match_score).
3. **Edge case'y i bugi reviewera**: I4 (invalid UUID), I5 (match_score bez bounds), I6 (connection pool — testowanie walidacji), D3 (CV bez górnego limitu).
4. **Regresja**: DELETE 204 No Content, PATCH 404, LIST ordering (ASC).

### Wyniki testów

```
======================== 60 passed, 2 xfailed in 0.18s ========================
```

**Pliki testów:**
- `backend/tests/test_applications_api.py` (41 testów)
- `backend/tests/test_applications_endpoints.py` (21 testów)

**Przebieg:** 39 PASSED + 2 XFAIL (oczekiwane niepowodzenia — bugi I5), ogółem 41 test_applications_api. 
W test_applications_endpoints: 21 PASSED (walidacja modeli, edge case'y).

Razem z istniejącymi testami (`test_overhaul.py`, `test_tailor.py`, `test_pdf.py`): 127 PASSED, 6 FAILED (test_pdf — nie mój zakres).

### XFAIL testy — potwierdzają problemy reviewera

1. **test_application_create_match_score_above_100_rejected** (I5)
   - XFAIL: ApplicationCreate.match_score = 150 powinno być odrzucone, ale przechodzi.
   - Model.match_score brakuje `Field(ge=0, le=100)`.
   - Konsekwencja: POST /applications/ z match_score > 100 jest zarchiwizowana, ale AnalysisOut.overall_score ma `ge=0, le=100`, co powoduje 500 na GET /analyses (validacja response_model odrzuca nieválný wiersz).

2. **test_application_create_match_score_negative_rejected** (I5)
   - XFAIL: ApplicationCreate.match_score = -10 powinno być odrzucone, ale przechodzi.
   - Symetrycznie do powyższego.

### Bugi zgłoszone przez testy

**Nowe bugi odkryte testami:**
- Brak (testy dokumentują istniejące problemy reviewera, nie znalazły nowych).

**Bugi reviewera potwierdzone testami:**
- **I5 (potwierdzony)**: test_application_create_match_score_above_100_rejected XFAIL pokazuje, że ApplicationCreate akceptuje match_score > 100, podczas gdy AnalysisOut odrzuca overall_score > 100. To tworzy asymetrię — można zapisać 150, ale nie można go przeczytać (500 na GET).
- **D3 (potwierdzony)**: test_cv_no_upper_limit_in_validation pokazuje, że ReanalyseRequest.cv nie ma max_length — użytkownik może wkleić 1MB CV bez walidacji modelu (walidacja 50 chars minimum jest w route, ale brak maksimum).

### Edge case'y i walidacja

**Przeszły testy (bez problemów):**
- ApplicationStatus enum (4 wartości, case-sensitive lowercase).
- MatchCategory score bounds (0–100 walidowany).
- AnalysisOut.overall_score bounds (0–100 walidowany, inaczej niż ApplicationCreate.match_score).
- ReanalyseRequest CV minimum (model nie waliduje, route sprawdza 50 chars + strip).
- ReanalyseRequest job_description override (route: body.jd OR saved jd, fallback 404 jeśli brak).
- JSONB round-trip (missing_keywords list, categories objects deserializowane poprawnie).
- ApplicationOut.job_description field present (nowy w Fazie 5).
- DELETE 204 status (regression: endpoint zwraca bez body).
- Analyses ordered ASC by created_at (route ORDER BY created_at ASC).

### Wymaga testu manualnego / przyszłej infrastruktury

1. **I6 (testowanie connection pool)**: nie da się testować w unit testach bez realnego asyncpg.Pool. Wymaga testów integracyjnych z PostgreSQL.
2. **I4 (invalid UUID → 500)**: Testowanie HTTP ze złym UUID wymaga pełnego mocking'u context managera asyncpg. Zalecane: testy integracyjne lub endpoint-level test z TestClient po naprawie (jeśli frontend doda UUID type hint).
3. **Realne działanie transakcji** (Faza 5): INSERT aplikacji + INSERT analyses w jednej transakcji — model-level test nie pokrywa — wymaga DB test.
4. **Frontend**: K1/I1/I2/I3/I7/I8/I9 wymaga testu manualnego/Cypress (brak infrastruktury testowej, jest vitest ale używa się go dla integralności build, nie dla runtime HTTP).

### Podsumowanie pokrycia

- **Backend:** 60 nowych testów pokrywa modele Fazy 5 (ApplicationCreate, AnalysisOut, ReanalyseRequest) i edge case'y.
- **Potwierdzone problemy:** I5 (match_score bounds), D3 (CV limit).
- **Status:** Testy przechodzą, 2 XFAIL-e dokumentują znane bugi — kod produkcyjny nie był naprawiany (jak zalecane).
- **Frontend:** Poprawki K1 (SaveApplicationModal.saving reset) już w głównej sesji. Problemy I1/I2/I3/I7/I8/I9 wymagają testu manualnego/e2e (brak infrastruktury).

---

## Naprawy po review (główna sesja)

Frontend (build+lint czyste po zmianach):
- **K1** `SaveApplicationModal.tsx` — `setSaving(false)` przeniesione do `finally`; drugi zapis w sesji nie blokuje się.
- **I1/I2** `lib/hooks/useApplications.ts` — poprzedni stan do rollbacku łapany wewnątrz funkcyjnych setterów (bez stale closure, `useCallback` bez zależności od `applications`); rollback delete wstawia z powrotem tylko usunięty element na dawną pozycję.
- **I3** `lib/cv-context.tsx` — walidatory kształtu `isAnalyseResult`/`isReviewResult`; nieprawidłowy zapis degradowany do null z zachowaniem CV/JD.
- **I8** `globals.css` — print-reguła warunkowa: `body:has(#pdf-print-root)`; Ctrl+P na stronach bez eksportu drukuje normalnie.
- **I9** `kanban/KanbanCard.tsx` — `touch-none` → `touch-manipulation` (scroll od karty działa, long-press drag zostaje).

Backend (135/135 testów pass):
- **I4** `routes/applications.py` — `_parse_app_id()`: nieprawidłowy UUID → 404 zamiast 500 (wszystkie endpointy `/{app_id}`); parametry przekazywane jako `uuid.UUID`.
- **I5** `models.py` — `ApplicationCreate.match_score: Field(ge=0, le=100)`; usunięta asymetria POST/GET. Testy xfail test-writera odwrócone na pozytywne asercje.
- **I6** `routes/applications.py` — re-analiza nie trzyma połączenia puli podczas wywołań AI (acquire → fetch → release; AI; acquire → transakcja); wyścig delete-podczas-analizy łapany przez `ForeignKeyViolationError` → 404. Przy okazji usunięty wyciek `str(e)` w detail 500 (DROBNY z listy).
- **D3** — górny limit CV 30000 znaków w POST `/analyses`.

Testy `tests/test_pdf.py` — 6 failujących testów było zepsutych OD POCZĄTKU (pre-existing, nie regresja Fazy 4): mocki nie konfigurowały `bbox`/`extract_words` (wymagane przez detekcję kolumn), nie mockowały async `clean_cv_text_ai`, teksty krótsze niż walidacyjne minimum 50 znaków, asercje na nieistniejące komunikaty. Przepisane; 9/9 pass.

Weryfikacja końcowa: pełny suite backendu 135 passed; frontend lint+build exit 0; smoke na mocku — kanban tap-status i delete spójne z serwerem (UI=API), ledger dashboardu pokazuje zdarzenie "→ interview".

Świadomie NIEnaprawione (odnotowane): I7 (hardening escape() w print-portalu pod przyszłe zmiany — dziś bez wektora), pozostałe DROBNE z listy reviewera (m.in. strefy czasowe w agregacjach tygodni/heatmapy, #00FF88 poza paletą, pojedyncze komponenty >100 linii, kosmetyczne rozbieżności mock↔backend).
