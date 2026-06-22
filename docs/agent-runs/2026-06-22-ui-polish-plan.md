# Plan UI Polish — 2026-06-22

## Cel
Szlif wizualny aplikacji Hireworthy: fixed sidebar, padding contentu, rozbudowa landing page o sekcje wyjaśniające produkt, poprawki czytelności i UX w Review / Analyse / Dashboard / Applications. ZERO nowej funkcjonalności, ZERO border-radius. Paleta: #080808, #111111, #222222, #E8FF00, #FF3D00, #00FF88, #F5F5F5, #666666.

## Pliki do zmiany/utworzenia
- `frontend/app/layout.tsx`
- `frontend/components/Sidebar.tsx`
- `frontend/app/page.tsx`
- `frontend/app/review/page.tsx`
- `frontend/components/CvInput.tsx`
- `frontend/app/analyse/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/applications/page.tsx`

UWAGA: nie tworzymy nowych plików. Sidebar jest renderowany w `layout.tsx` (a nie w pliku page), więc fixed positioning + margin trzeba skoordynować między tymi dwoma plikami.

---

## Kroki implementacji

### Krok 1 — Sidebar fixed position (components/Sidebar.tsx)
Plik: `components/Sidebar.tsx`, element `<aside className="sidebar-shell ...">` (linie 27-32).

Stan obecny: `<aside>` jest w flow flexa (`shrink-0`), `style={{ minHeight: "100vh" }}`, brak position.

Zmiana:
- Dodać do `style` inline: `position: "fixed"`, `top: 0`, `left: 0`, `height: "100vh"`, `zIndex: 40`. Zostawić istniejące `minHeight: "100vh"` lub zastąpić przez `height: "100vh"` (preferowane `height`).
- Hover-expand działa przez klasę `.sidebar-shell` w globals.css (szerokość 56px→200px sterowana CSS-em na hover) ORAZ `expanded` state. Ponieważ sidebar staje się `fixed`, jego rozwijanie do 200px NIE może już przesuwać contentu (bo content ma stały margin) — to jest pożądane zachowanie. NIE zmieniać logiki `expanded`/onMouseEnter/onMouseLeave.
- Ponieważ `position: fixed` wyrywa element z flow, klasa `shrink-0` przestaje mieć znaczenie dla layoutu — można ją zostawić (bez szkody) lub usunąć; zostawić dla minimalnej zmiany.

State: brak nowego state.

### Krok 2 — Content margin + padding (app/layout.tsx)
Plik: `app/layout.tsx`, element `<main className="flex-1 p-8 overflow-auto min-h-screen">` (linia 29) oraz `<body className="flex min-h-screen ...">` (linia 27).

Stan obecny: `<body>` ma `flex`, sidebar był w flow i zajmował 56px. Po Kroku 1 sidebar jest fixed, więc content wskoczyłby pod sidebar.

Zmiana:
- Na `<main>` dodać margines lewy równy szerokości zwiniętego sidebara: dodać inline `style={{ marginLeft: "56px" }}` (lub klasa `ml-14` = 56px w Tailwind; 14*4px=56px — OK). Preferuj inline `marginLeft: "56px"` dla pewności wartości.
- `p-8` zostaje (zapewnia padding wewnętrzny ze wszystkich stron, w tym lewy 2rem od krawędzi sidebara). To pokrywa zadanie 1 (content padding) — `pl-8` już zawarte w `p-8`, nie trzeba dublować.
- `flex` na `<body>` można zostawić; przy fixed sidebarze flex nie szkodzi, ale marginLeft na main jest tym, co realnie odsuwa content. Zostawić `flex` dla minimalnej zmiany.

State: brak.

Edge case: landing page (`app/page.tsx`) renderuje własny `<main style={{minHeight:100vh, ...center}}>` WEWNĄTRZ `<main>` z layoutu. Centrowanie hero będzie liczone względem obszaru po odjęciu 56px marginu — to akceptowalne i pożądane. Zwrócić uwagę przy Kroku 3, że szerokość dostępna jest pomniejszona o 56px.

### Krok 3 — Landing page rozbudowa (app/page.tsx)
Plik: `app/page.tsx`. Obecnie tylko hero w wyśrodkowanym `<main style={{minHeight:100vh, justifyContent:center}}>`.

Zmiana strukturalna: hero NIE może już zajmować pełnego `100vh` z `justifyContent: center`, bo pod nim mają być 3 sekcje wymagające scrolla. Przebudować root:
- Zewnętrzny kontener: usunąć `justifyContent:"center"` i `minHeight:"100vh"` z głównego `<main>` ALBO zostawić hero jako pierwszą sekcję o `minHeight` mniejszej (np. naturalna wysokość z dużym `padding`). Rekomendacja: zmienić root `<main>` na `display:flex; flexDirection:column` BEZ wymuszonego center/100vh; hero zostaje pierwszą sekcją wyśrodkowaną poziomo (`alignItems:center`, `textAlign:center`) z `padding: "6rem 2rem"`.
- Wszystkie nowe sekcje wrappować w kontener `maxWidth: "1000px", margin: "0 auto", width: "100%"` dla spójności, z `padding` poziomym.

Sekcja A — "HOW IT WORKS" (pod hero):
- Nagłówek sekcji: mały label uppercase `fontSize:"0.65rem", letterSpacing:"0.2em", color:"#666666"` z tekstem "HOW IT WORKS".
- Kontener 3 kolumn: `display:grid; gridTemplateColumns: repeat(3, 1fr); gap: "1px"` LUB `gap: "2rem"`. Skoro każda kolumna ma `border-top: 1px solid #222222`, użyć `gap: "2rem"` i osobnego border-top na każdej kolumnie.
- Każda kolumna (3 sztuki, najlepiej zmapować z lokalnej tablicy `const steps = [...]`):
  - `borderTop: "1px solid #222222"`, `paddingTop: "1.5rem"`, flex column gap.
  - Numer: `01`/`02`/`03`, `color:"#E8FF00"`, font-display bold, `fontSize:"2rem"`, monospace/tabular.
  - Tytuł: bold white (`#F5F5F5`), `fontSize:"1rem"`.
  - Opis: `color:"#666666"`, `fontSize:"0.85rem"`.
  - Treść:
    - 01 "Upload your CV" / "Paste text or drop a PDF"
    - 02 "Get brutally honest feedback" / "AI scores every section"
    - 03 "Fix what matters" / "Download a tailored CV"
- Responsywność: na wąskich ekranach `gridTemplateColumns` może zostać `repeat(3,1fr)` (akceptowalne) lub dodać media — minimalnie zostawić 3 kolumny.

Sekcja B — "WHAT YOU GET":
- Label uppercase jak wyżej, tekst "WHAT YOU GET".
- Grid 3 kart: `display:grid; gridTemplateColumns: repeat(3, 1fr); gap: "1.5rem"`.
- Każda karta: `background:"#111111"`, `border:"1px solid #222222"`, `padding:"1.5rem"`, sharp corners (border-radius już globalnie 0, nie ustawiać radius).
  - Tytuł bold white `#F5F5F5`, opis `#666666`.
  - Treść:
    - "CV Score" / "Overall score 0-100 with section breakdown"
    - "Job Match" / "Paste any job description, see your fit percentage"
    - "Auto-Tailor" / "AI rewrites your bullet points for the role"

Sekcja C — Bottom CTA strip:
- Full-width strip (rozciąga się na całą szerokość contentu): `background:"#111111"`, `borderTop:"1px solid #222222"`, `padding:"2rem"`.
- WAŻNE: ma być "full-width". Content ma `p-8` w layout + ten strip wewnątrz `maxWidth:1000px` kontenera. Żeby strip był wizualnie pełną szerokością sekcji, umieścić go POZA kontenerem maxWidth (bezpośrednio w root `<main>` page.tsx) tak, by rozciągał się na całą dostępną szerokość; wewnątrz stripa wyśrodkować zawartość kontenerem `maxWidth:1000px, margin:0 auto`.
- Layout wewnątrz: `display:flex; justifyContent:"space-between"; alignItems:"center"; flexWrap:"wrap"; gap:"1rem"`.
- Lewa: tekst "Ready to know where you stand?" `color:"#F5F5F5"`, font-display.
- Prawa: `<Link href="/review">` button "REVIEW MY CV →", `background:"#E8FF00"`, `color:"#080808"`, `padding:"1rem 2rem"`, uppercase bold (analogicznie do istniejącego CTA hero z linii 19-25).

State: brak. Import `Link` z `next/link` już jest.

### Krok 4 — Review CV + CvInput (components/CvInput.tsx, app/review/page.tsx)

#### 4a. Textarea min-height 280px — components/CvInput.tsx
Obiekt `inputStyle` (linie 12-24), pole `height: "240px"`. Zmienić na `height: "280px"` (lub `minHeight: "280px"`). Preferuj `minHeight: "280px"` zamiast sztywnego `height`, zostawiając `height` usunięty — ale UWAGA: ten sam `inputStyle` jest też zdefiniowany OSOBNO w `analyse/page.tsx` (linie 11-23) dla pola JD; tam ma być 240px (Krok 5c). Czyli zmiana w CvInput.tsx (280) jest niezależna od analyse (240). CvInput jest używany na review (280 oczekiwane) ORAZ na analyse jako pole "Your CV" (Krok 5c oczekuje 240 dla obu textarea).
- KONFLIKT: CvInput ma jeden `inputStyle`, a oczekiwania to 280px na review i 240px na analyse. Rozwiązanie: dodać do `Props` opcjonalny prop `minHeight?: number` (domyślnie 280). W `review/page.tsx` nie przekazywać (→280); w `analyse/page.tsx` przekazać `minHeight={240}`. W `inputStyle` zastąpić `height: "240px"` przez `minHeight: \`${minHeight ?? 280}px\`` (usunąć sztywne `height`). To minimalna zmiana sygnatury, nie nowa funkcjonalność.
- Analogicznie pole dropzone PDF (linie 142-153) ma `height:"240px"` — dla spójności ustawić na tę samą wartość co textarea (`minHeight ?? 280`).

#### 4b. Word count pod textarea — components/CvInput.tsx
Pod `<textarea>` (po linii 122, w bloku `mode === "text"`), dodać licznik słów.
- Obliczenie: `const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;` (policzyć w ciele komponentu, na podstawie `value` — live update bo `value` to controlled prop).
- Render: `<p style={{fontSize:"0.7rem", color:"#666666"}}>{wordCount} words</p>` pod textarea (obok/zamiast bloku filename albo dodatkowo).
- State: NIE potrzebny nowy state — liczymy z `value`. UWAGA na regułę z memory: hooki/useMemo (jeśli użyjesz useMemo) muszą być przed jakimkolwiek warunkowym return. Tutaj prosty wyliczany const wystarczy, bez useMemo.

#### 4c. Toggle PASTE TEXT / UPLOAD PDF style — components/CvInput.tsx
Obiekty `activeStyle` (89-93) i `inactiveStyle` (95-99).
- `activeStyle`: już `background:"#E8FF00", color:"#080808"` — OK, zostaje. Upewnić się że border aktywnego jest spójny (obecnie dziedziczy `border:"1px solid #222222"` z base — zostawić lub ustawić `border:"1px solid #E8FF00"`; minimalnie zostawić).
- `inactiveStyle`: dodać/zmienić `border: "1px solid #444444"` (obecnie dziedziczy `#222222` z base — nadpisać na `#444444`), `color:"#666666"` (już jest), `background:"transparent"` (już jest).
- W `toggleBtnBase` border jest `#222222`; w `inactiveStyle` dodać jawnie `border:"1px solid #444444"` żeby nadpisać.

#### 4d. Przycisk "ANALYSE CV →" disabled style — app/review/page.tsx
Button (linie 48-66). Obecny warunek disabled: `cv.trim().length < 50 || loading`, kolory: disabled `background:"#333333", color:"#666666"`.
- Zmiana kolorów disabled wg zadania: `background:"#1a1a1a", color:"#444444"`. Zaktualizować oba miejsca w `style` (background i color) używając tego samego warunku.
- Aktywny: `background:"#E8FF00", color:"#080808"` (już jest).
- UWAGA: warunek `< 50` znaków to istniejąca walidacja — zachować ją (nie zmieniać na sam `!cv.trim()`), to nie jest objęte zadaniem; zadanie mówi tylko o kolorach disabled vs aktywny. Zostawić logikę, zmienić tylko paletę disabled.

### Krok 5 — Analyse Match (app/analyse/page.tsx)

#### 5a. Centrowanie contentu
Root `<div className="flex flex-col gap-10 max-w-4xl">` (linia 43). Obecnie `max-w-4xl` bez centrowania (lewo-wyrównany).
- Dodać `mx-auto` → `className="flex flex-col gap-10 max-w-4xl mx-auto"`. Daje wyśrodkowanie jak na review.

#### 5b. Dwa textareas 50/50
Kontener inputów: `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">` (linia 55). Już jest `md:grid-cols-2` (50/50 na desktop). Zadanie spełnione — zostawić. Opcjonalnie wymusić `grid-cols-2` bez breakpointu, ale `md:` jest lepsze dla mobile; ZOSTAWIĆ bez zmian.

#### 5c. Oba textareas min-height 240px
- Pole JD: lokalny `inputStyle` (linie 11-23) ma `height:"240px"` → zmienić na `minHeight:"240px"` (usunąć sztywne `height`).
- Pole "Your CV" to `<CvInput value={cv} onChange={setCv} />` (linia 63) → przekazać `minHeight={240}` (prop dodany w Kroku 4a).

#### 5d. Przycisk "ANALYSE →" disabled gdy którekolwiek puste
Button (linie 86-99). Obecnie `disabled={loading}`; walidacja pustych pól dopiero w `handleAnalyse` (alert tekstowy).
- Dodać warunek wyliczany: `const canSubmit = cv.trim().length > 0 && jd.trim().length > 0;`
- `disabled={loading || !canSubmit}`.
- `style.background`: `loading ? "#b3c700" : (!canSubmit ? "#1a1a1a" : "#E8FF00")`.
- `style.color`: `!canSubmit && !loading ? "#444444" : "#080808"`.
- `style.cursor`: `loading || !canSubmit ? "not-allowed" : "pointer"`.
- State: brak nowego state — wyliczane z `cv`/`jd`.

#### 5e. Labels "YOUR CV" / "JOB DESCRIPTION" bold white
Dwa `<label>` (linie 57-62 i 65-71). Obecnie `className="uppercase tracking-widest font-medium"`, `style={{fontSize:"0.65rem", color:"#666666"}}`.
- Zmiana: `font-medium` → `font-bold`, `color:"#666666"` → `color:"#F5F5F5"`. Zostawić `fontSize:"0.65rem"` i uppercase/tracking (zadanie mówi tylko bold + white).

### Krok 6 — Dashboard (app/dashboard/page.tsx)

#### 6a. Usunąć gauge/semicircle
WAŻNE odkrycie: w obecnym kodzie NIE MA GaugeChart/RadialBarChart ani semicircle. Są dwa wykresy: BarChart "Applications / Week" (linie 139-160) i PieChart donut "By Status" (linie 162-198). PieChart już jest donutem (`innerRadius={50}`), nie semicircle.
- Wniosek: brak elementu do usunięcia zgodnie z opisem zadania. NIE usuwać BarChart (to nie gauge). Jeśli orchestrator/explorer miał na myśli `MatchScore` (semicircle) — ten komponent jest na stronie analyse, nie dashboard. 
- DZIAŁANIE: nie usuwać niczego pochopnie. Coder ma to ZGŁOSIĆ jako rozbieżność i pominąć 6a, chyba że main session potwierdzi. (Patrz Ryzyka.)

#### 6b. Zwiększyć kontener donut chart
PieChart `<ResponsiveContainer width="100%" height={200}>` (linia 173). Zwiększyć `height` na `260` (więcej miejsca). Opcjonalnie zwiększyć `outerRadius={80}`→`100` i `innerRadius={50}`→`62` proporcjonalnie, by donut wypełnił większy kontener. Trzymać się palety/kształtu.

#### 6c. "STAGE BREAKDOWN" font-size 0.65rem → 0.75rem
Zadanie wskazuje label "STAGE BREAKDOWN". W kodzie nagłówek "Stage Breakdown" (linia 205) używa klasy `text-sm` (0.875rem), nie 0.65rem — to nie ten element. Element z `fontSize:"0.65rem"` to etykiety statusów wewnątrz breakdown (linia 217: `<span ... style={{fontSize:"0.65rem", color:"#666666"}}>{s}</span>`).
- Interpretacja: zadanie odnosi się prawdopodobnie do tych etykiet (applied/interview/...) `0.65rem`. Zmienić `fontSize:"0.65rem"` → `"0.75rem"` w linii 217.
- UWAGA: rozbieżność nazwy — coder powinien zmienić etykiety statusów w sekcji Stage Breakdown (linia 217). Jeśli intencją był tytuł sekcji, jest już 0.875rem (większy) — nic do roboty. Zmienić linię 217.

### Krok 7 — Applications (app/applications/page.tsx)

#### 7a. Hover border-left na wierszach
Wiersze: `<div className="accent-row grid items-center" style={{... borderBottom, padding, minHeight, background:"#111111"}}>` (linie 113-123).
- Dodać hover state per-wiersz. Najczystsze rozwiązanie BEZ JS: jeśli klasa `.accent-row` w globals.css obsługuje hover — sprawdzić. Zadanie wymaga też pokazania trash icon na hover (7b), więc potrzebny wspólny mechanizm hover. 
- Rekomendacja: użyć handlerów `onMouseEnter`/`onMouseLeave` na wierszu, sterujących stanem `hoveredId` (jeden state w komponencie: `const [hoveredId, setHoveredId] = useState<string | null>(null)`).
  - Na wierszu: dodać inline `style` `borderLeft: hoveredId === app.id ? "2px solid #E8FF00" : "2px solid transparent"`. UWAGA: dodanie border-left 2px zmieni szerokość/wyrównanie — żeby nie skakało, zawsze rezerwować 2px (transparent gdy nie hover).
  - `onMouseEnter={() => setHoveredId(app.id)}`, `onMouseLeave={() => setHoveredId(null)}`.
- Alternatywa CSS-only (preferowana jeśli `.accent-row` istnieje): border-left przez `.accent-row:hover` w globals.css i `.accent-row:hover .trash-btn { opacity:1 }`. Jednak skoro projekt miesza inline i nie wiemy co jest w `.accent-row`, użyć podejścia ze state `hoveredId` (pewne, jeden state, zgodne z konwencją inline dla dynamicznych wartości).

#### 7b. Trash icon visible tylko na hover wiersza
Button trash (linie 138-147). Obecnie zawsze widoczny, `color:"#333333"`.
- Dodać do `style` buttona: `opacity: hoveredId === app.id ? 1 : 0`, `transition: "opacity 0.15s"`. Zostawić istniejące hover-color handlery na samym buttonie (#333→#FF3D00).
- State: współdzielony `hoveredId` z 7a.

#### 7c. "APPLIED" badge czytelność
Badge renderuje komponent `StatusBadge` (`components/StatusBadge.tsx`) — NIE jest w tym pliku. 
- Kolor "applied" pochodzi prawdopodobnie z mapy kolorów w StatusBadge (analogicznie do dashboard `PIE_COLORS.applied = "#444444"` — za ciemny, nieczytelny).
- DZIAŁANIE: edycja wymaga otwarcia `components/StatusBadge.tsx` (poza listą plików z zadania). Zmienić kolor tekstu statusu "applied" na `#888888` (czytelny na ciemnym tle). Coder ma doczytać StatusBadge.tsx i zlokalizować mapę kolorów/styl dla statusu "applied", zmienić text color → `#888888`. Jeśli badge używa też background, dostosować by tekst był legible (nie zmieniać innych statusów).
- UWAGA: to rozszerza listę plików o `components/StatusBadge.tsx`. Zgłoszone w Ryzykach.

---

## Ryzyka i na co uważać

1. **Sidebar fixed + layout (Kroki 1-2 sprzężone):** muszą być zrobione razem. Sam fixed bez marginu na `<main>` schowa content pod sidebar; sam margin bez fixed da podwójny odstęp. Sprawdzić wizualnie że content zaczyna się 56px od lewej + 2rem padding, a rozwinięcie sidebara do 200px NAKŁADA się na content (overlay) zamiast go przesuwać — to oczekiwane przy fixed.

2. **z-index:** sidebar `z-index: 40`. Sprawdzić, czy modale (`SaveApplicationModal`) mają wyższy z-index — jeśli modal ma niższy/brak, sidebar przykryje overlay. Jeśli pojawi się konflikt, modal musi mieć z-index > 40. Zgłosić jeśli wykryte.

3. **`inputStyle` zduplikowany** w CvInput.tsx i analyse/page.tsx — to dwa osobne obiekty. Zmiana w jednym nie wpływa na drugi. Prop `minHeight` w CvInput rozwiązuje konflikt 280 vs 240. Nie zapomnieć przekazać `minHeight={240}` w analyse.

4. **Dashboard 6a — brak gauge do usunięcia:** rzeczywisty kod nie zawiera semicircle/gauge na dashboardzie (PieChart to już donut). Coder NIE powinien usuwać BarChart ani PieChart. Pominąć 6a i zgłosić rozbieżność main session. Komponent `MatchScore` (semicircle) jest na /analyse, nie dashboard — nie ruszać go w ramach tego zadania.

5. **Dashboard 6c — rozbieżność nazwy:** "STAGE BREAKDOWN" jako tytuł sekcji ma już 0.875rem (text-sm); element 0.65rem to etykiety statusów (linia 217). Zmienić etykiety statusów na 0.75rem. Potwierdzić intencję jeśli wątpliwość.

6. **Applications 7c — StatusBadge poza listą plików:** zmiana czytelności "APPLIED" wymaga edycji `components/StatusBadge.tsx`. Doczytać ten plik przed zmianą, zmienić tylko kolor statusu "applied" → `#888888`, nie ruszać pozostałych statusów.

7. **Reguła hooków (z auto-memory):** w komponentach (CvInput, applications, analyse) jeśli dodajesz `useMemo`/`useCallback`/`useState`, muszą być PRZED jakimkolwiek warunkowym `return`. Word count i canSubmit najlepiej jako zwykłe wyliczane const (bez hooka) → bezpieczne. `hoveredId` w applications: `useState` na górze komponentu, przed return.

8. **Border-left zmienia layout:** w applications i (już istniejące) suggestions na analyse — zawsze rezerwować 2px (transparent gdy nieaktywny), żeby treść nie skakała w poziomie przy hover.

9. **Landing page przebudowa flow (Krok 3):** usunięcie `justifyContent:center` + `100vh` z hero zmienia centrowanie pionowe. Hero ma zostać czytelny u góry, sekcje pod nim scrollowalne. Bottom CTA full-width musi być poza maxWidth-kontenerem, ale jego wnętrze wyśrodkowane. Uważać, że page jest wewnątrz `<main>` z layoutu (ma już p-8 + marginLeft 56px) — "full-width strip" to pełna szerokość obszaru contentu, nie viewportu.

10. **ZERO border-radius / ZERO nowej funkcjonalności:** nie dodawać radius (globalnie 0 — nie nadpisywać). Nie dodawać nowych akcji/endpointów. Trzymać się palety kolorów z reguł.

## Następny krok pipeline
Plik raportu dla reviewer/test-writer: `docs/agent-runs/2026-06-22-ui-polish-raport.md`
