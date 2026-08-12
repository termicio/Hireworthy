# Plan implementacji: Redesign HIREWORTHY (AI Job Application Tracker)

Data: 2026-07-02
Nazwa bazowa pipeline: `2026-07-02-redesign-audyt`
Kierunek wizualny: HYBRYDA A+B (czerń + #E8FF00 + #FF3D00, ostre rogi, Space Grotesk jako display).

---

## Cel

Kompleksowy redesign aplikacji obejmujący trzy warstwy:
1. **Fundamenty** — naprawa 8 krytycznych bugów runtime i ujednolicenie systemu stylów (koniec z miksem inline/Tailwind, jedna paleta, jeden system borderów, spójne nagłówki).
2. **Redesign widoków** — Applications jako Kanban board (drag&drop), Dashboard jako layout editorial (funnel + ledger + narracja), mikrointerakcje framer-motion, empty states z CTA.
3. **Nowe funkcje** — historia analiz per aplikacja + wykres progresji score, uporządkowanie PDF, persystencja cv-context (sessionStorage), naprawa środowiska dev.

Zasada nadrzędna: fundamenty przed redesignem, redesign przed nowymi funkcjami. Nie wolno budować Kanbana na zepsutym `api.ts` (bug DELETE 204) ani nowego stylu na miksie inline/Tailwind.

---

## KROK ZEROWY (obowiązkowy, przed jakimkolwiek kodem frontendu)

**Coder MUSI przeczytać relevantne guide'y z `frontend/node_modules/next/dist/` przed pisaniem kodu.**
Powód: `frontend/AGENTS.md` ostrzega, że Next.js 16.2.9 ma breaking changes względem wiedzy treningowej modelu. Wiedza z pamięci modelu o App Routerze może być nieaktualna.

Zakres lektury (konkretnie, nie eksploracja swobodna):
- Docs/guide dot. dynamic route params (Next 16 — `params` w page/route handlerach bywa Promise, wymaga `await`) — krytyczne dla nowej strony/drawera `/applications/[id]`.
- Docs dot. Route Handlers / API (jeśli cokolwiek dotykamy po stronie Next — tu raczej nie, backend to FastAPI, ale zweryfikować).
- Docs dot. `'use client'` boundary i Server Components — bo Kanban, drag&drop, framer-motion, recharts wszystko wymaga client components.
- Jeśli guide'ów nie ma w `node_modules/next/dist/docs/`, coder ma to ZGŁOSIĆ (zatrzymanie), nie zgadywać API.

Deliverable kroku: krótka notatka w `docs/agent-runs/2026-07-02-redesign-audyt-raport.md` (sekcja "Next 16 — ustalenia") z faktami, które wpływają na implementację (np. czy `params` jest Promise).

---

## FAZA 1 — FUNDAMENTY: bugfixy krytyczne + środowisko dev

Cel fazy: aplikacja startuje, DELETE działa, mobile nie jest zasłonięty, banner i chart poprawne. Bez tego reszta nie ma sensu.

### Pliki do zmiany
- `backend/requirements.txt`
- `backend/.env` (utworzyć na bazie szablonu; sekrety dostarcza użytkownik)
- `frontend/lib/api.ts`
- `frontend/app/applications/page.tsx`
- `frontend/app/layout.tsx`
- `frontend/app/globals.css`
- komponent Sidebar (`frontend/components/Sidebar.tsx` — ścieżkę potwierdzić)
- Dashboard bar chart (komponent/strona `frontend/app/dashboard/page.tsx` + komponent wykresu tygodni)
- komponent bannera "Showing previous results" (w `/review` i `/analyse` — potwierdzić lokalizację)

### Kroki

1. **asyncpg do requirements** (bug 1). Dopisać `asyncpg` (z wersją zgodną z resztą, np. `asyncpg>=0.29`) do `backend/requirements.txt`. Zweryfikować, że nic innego z database.py nie jest pominięte (np. `python-dotenv`, `pdfplumber`, `anthropic`, `fastapi`, `uvicorn`, `pydantic`). Coder ma tylko DOPISAĆ brakujące, nie usuwać istniejących.

2. **backend/.env** (D). Utworzyć plik `backend/.env` z pustymi placeholderami:
   ```
   DATABASE_URL=
   ANTHROPIC_API_KEY=
   ```
   NIE wpisywać żadnych sekretów. W raporcie dopisać instrukcję uruchomienia (venv, aktywacja, `pip install -r requirements.txt`, `uvicorn main:app --reload`, `docker-compose up db` lub Supabase URL). Sprawdzić, czy jest `.gitignore` z `.env` — jeśli nie, ZGŁOSIĆ (nie commitować sekretów). Zatrzymanie: URL bazy dostarcza użytkownik — coder nie wymyśla.

3. **api.ts — obsługa 204 / pustego body** (bug 2). W funkcji `request()`:
   - Jeśli `res.status === 204` lub `Content-Length === "0"` lub brak body → zwrócić `undefined`/`null` zamiast wołać `res.json()`.
   - Zachować obsługę błędów HTTP (status >= 400) — rzucać wyjątek z czytelnym komunikatem (spróbować sparsować JSON błędu, fallback na `res.statusText`).
   - Sygnatura generyczna ma pozwalać na `request<void>(...)` dla DELETE.
   Ilustracyjnie (NIE gotowa implementacja):
   ```
   if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
   ```

4. **applications/page.tsx — pokazywać błędy update/delete** (bug 2 c.d.). Usunąć cichy `catch` połykający wyjątek. Wprowadzić stan błędu (np. `actionError`) wyświetlany użytkownikowi (toast/inline banner w palecie #FF3D00). Optimistic update: usuwać wiersz z UI od razu, przy błędzie rollback + komunikat. (Ta strona i tak zostanie zastąpiona Kanbanem w Fazie 3 — ale bug musi być naprawiony też tutaj, bo Faza 3 dziedziczy logikę API; alternatywnie: napraw logikę w warstwie api.ts/hooku, żeby Kanban ją odziedziczył. Rekomendacja: wydzielić logikę CRUD aplikacji do hooka `useApplications` już teraz — patrz Faza 3 krok Kanban.)

5. **Mobile sidebar + layout marginLeft** (bug 3). To dwa sprzężone problemy:
   - `layout.tsx`: usunąć inline `marginLeft: 72px` z hardkodu. Zastąpić klasą Tailwind responsywną (np. `md:ml-[72px] ml-0`) LUB zmienną CSS sterowaną media query. Margines desktopowy tylko od breakpointu md w górę.
   - `globals.css`: media query `≤640px` dla `.sidebar-shell` — usunąć `position:fixed; width:100%; height:100vh; z-index:40` które przykrywa treść. Docelowo mobile ma mieć realny bottom-nav (nie fullscreen overlay). Zaproponować: sidebar jako pasek dolny `position:fixed; bottom:0; height:56px; width:100%` z ikonami poziomo, treść dostaje `padding-bottom` na wysokość paska. To wymaga zmiany w komponencie Sidebar (renderowanie poziome na mobile) — patrz krok 6.

6. **Sidebar — hover-expand nie zasłania treści (desktop)** (bug 6) + spójność z krokiem 5. Sidebar rozwijany hoverem NIE może overlayować treści. Dwie opcje (coder wybiera, uzasadnia w raporcie):
   - (a) Sidebar `position:fixed`, ale rozwinięcie robi się jako overlay Z PÓŁPRZEZROCZYSTYM tłem TYLKO nad własnym obszarem, a treść ma stały margines = szerokość zwiniętego (72px). Rozwinięcie "nachodzi" wizualnie, ale prościej: nie overlayować, tylko poszerzać i pushować treść (layout shift) — odrzucić jeśli powoduje przeskoki.
   - (b) REKOMENDACJA: sidebar rozwija się jako floating panel z cieniem/borderem, treść zostaje na marginesie 72px, panel ma wyższy z-index ale pojawia się z animacją i NIE zasłania nagłówka pierwszej karty, bo jest węższy niż treść i ma margines. Kluczowe: h1 i pierwsza karta muszą mieć wystarczający padding-left/margines, żeby rozwinięty sidebar (np. do 220px) ich nie dotykał, albo panel ma być `overflow` nad pustym marginesem.
   Zatrzymanie: jeśli po przemyśleniu żadna opcja nie daje się zrobić bez layout-shift lub zasłaniania — coder pokazuje wariant i pyta. Sidebar to komponent współdzielony przez wszystkie strony, więc regresja jest kosztowna.

7. **Dashboard bar chart — sort chronologiczny** (bug 4). Sortować dane tygodni po prawdziwej dacie (obiekt Date / ISO string), NIE po sformatowanej etykiecie `"08 Jun"`. Trzymać w danych pole `weekStart: Date/ISO`, sortować po nim rosnąco, etykietę generować do wyświetlenia osobno. (Uwaga: w Fazie 2 ten bar chart zostaje zdegradowany do sparkline — ale sort naprawiamy teraz, bo logika danych przechodzi dalej.)

8. **Banner "Showing previous results"** (bug 5). Banner ma się pokazywać TYLKO gdy użytkownik wraca na stronę z wcześniejszym wynikiem trzymanym w kontekście, a NIE natychmiast po świeżej analizie. Mechanizm: rozróżnić "wynik świeżo policzony w tej sesji widoku" od "wynik odziedziczony z kontekstu przy wejściu". Propozycja: flaga w cv-context `resultIsStale` / `lastAnalysisPage` albo lokalny ref ustawiany po świeżym submit. Po świeżym submit banner ukryty; po nawigacji-powrocie (mount z już istniejącym wynikiem) banner widoczny. Doprecyzować przy implementacji — jeśli logika kontekstu jest niejasna, coder ma najpierw przeczytać `frontend/lib/cv-context.tsx` (dozwolone, nazwany plik).

### Ryzyka Fazy 1
- Sidebar dotyka wszystkich stron — testować na każdej stronie i na mobile (≤640) oraz desktop.
- Zmiana `api.ts` request() dotyka WSZYSTKICH wywołań — regresja może dotknąć GET/POST. Zachować dotychczasowe zachowanie dla odpowiedzi z body.
- `.env` — nie commitować sekretów, zweryfikować `.gitignore`.

---

## FAZA 2 — SYSTEM STYLÓW (ujednolicenie przed redesignem widoków)

Cel: jeden system stylów, żeby redesign widoków (Faza 3) budować na spójnym fundamencie, nie mnożyć długu.

### Pliki do zmiany/utworzenia
- `frontend/app/globals.css` (tokeny, font Space Grotesk, skala nagłówków)
- `frontend/tailwind.config` (jeśli Tailwind 4 używa configu; w Tailwind 4 może być konfiguracja w CSS `@theme` — coder weryfikuje wg wersji)
- `frontend/components/ui/button.tsx` (OŻYWIĆ martwy plik — cva warianty)
- `frontend/components/CvInput.tsx` (usunąć resztki slate #1e293b/#334155)
- `frontend/components/HeatmapGrid.tsx` (usunąć borderRadius 2px, slate tooltip)
- wszystkie miejsca z inline hover przez `onMouseEnter` mutujące style (migracja na Tailwind `hover:`)
- nowy plik: `frontend/lib/design-tokens.ts` LUB sekcja `@theme` w globals.css (jedno źródło prawdy dla kolorów/borderów)

### Kroki

1. **Tokeny kolorów i borderów — jedno źródło prawdy.** Zdefiniować w `@theme`/config semantyczne tokeny zamiast czterech losowych szarości (#1a1a1a/#222/#333/#444):
   - `--color-bg: #080808`, `--color-surface: #111111`, `--color-border: #222222` (podstawowy hairline), `--color-border-strong: #333333` (jeśli potrzebny drugi poziom — MAX dwa poziomy borderów, uzasadnić), `--color-accent: #E8FF00`, `--color-danger: #FF3D00`.
   - Zmapować wszystkie użycia slate (#1e293b, #334155) i losowych szarości na te tokeny. CvInput drag&drop i HeatmapGrid tooltip: użyć `--color-surface`/`--color-border`.

2. **Font Space Grotesk (display).** Dodać Space Grotesk (przez `next/font/google` w layout.tsx — zweryfikować API next/font w Next 16 w kroku zerowym). Zdefiniować zmienną `--font-display`. Geist zostaje jako body, mono zostaje do danych/liczb. Nagłówki (h1/h2) i wielkie liczby → Space Grotesk.

3. **Skala nagłówków — spójny system** (niespójność H1). Wszystkie H1 na jeden system: `clamp()` (jak landing/review), koniec ze sztywnym `3rem` w analyse/dashboard/applications. Zdefiniować klasę/token `.h1` lub utility. Zastosować na wszystkich stronach.

4. **Border-radius 0 — zachować, ale usunąć wyjątki.** HeatmapGrid `borderRadius:2px` → 0. Potwierdzić, że globalne `!important` w globals.css zostaje.

5. **Button system (cva) — ożywić ui/button.tsx** (niespójność inline/Tailwind). Zaimplementować `button.tsx` z cva: warianty `primary` (accent neon na czerni), `danger` (#FF3D00), `ghost`/`outline` (hairline border). Ostre rogi. Ten komponent staje się JEDYNYM sposobem na przyciski. Zamienić inline-stylowane przyciski w istniejących komponentach na `<Button variant=...>`. (Uwaga: cva musi być w deps — jeśli nie ma, ZGŁOSIĆ przed dodaniem zależności; alternatywa: prosty helper `clsx`-owy bez cva, jeśli clsx/tailwind-merge są dostępne. Coder sprawdza package.json i proponuje.)

6. **Migracja inline hover → Tailwind.** Wyszukać `onMouseEnter`/`onMouseLeave` mutujące `style` i zamienić na klasy `hover:`. To jest głównie w kartach/przyciskach. Efekt: brak imperatywnych mutacji stylu.

7. **Responsywne gridy (przygotowanie pod mobile).** Landing "How it works"/"What you get": sztywne `gridTemplateColumns "1fr 1fr 1fr"` → Tailwind `grid-cols-1 md:grid-cols-3`. Tabela applications sztywny grid — zostanie zastąpiona Kanbanem (Faza 3), więc tu pominąć, ale landing naprawić.

### Ryzyka Fazy 2
- Tailwind 4 konfiguruje motyw w CSS (`@theme`), nie w `tailwind.config.js` jak wcześniej — coder MUSI zweryfikować (krok zerowy) zamiast zakładać.
- Migracja stylów na wielu komponentach — ryzyko regresji wizualnej. Robić komponent po komponencie, nie hurtem.
- `next/font` API w Next 16 — zweryfikować w kroku zerowym.

---

## FAZA 3 — REDESIGN WIDOKÓW

### 3A. Applications → Kanban board

#### Decyzja: biblioteka DnD
Rekomendacja: **@dnd-kit** (dodać do deps), NIE samo framer-motion.
Uzasadnienie: framer-motion `drag` świetnie animuje pojedynczy element, ale cross-column drag-and-drop z detekcją kolizji, sortowaniem i "drop zones" między kolumnami wymaga sporo ręcznej logiki (hit-testing kolumn, reorder). @dnd-kit jest zaprojektowany dokładnie do tego (sensors, collision detection, `DndContext`/`SortableContext`), jest lekki, dostępny (a11y, keyboard), i dobrze współgra z React 19. Animacje wizualne kart (nie sam drag) nadal robi framer-motion. **Zatrzymanie:** dodanie zależności = decyzja użytkownika — coder ma to zaproponować i POCZEKAĆ na zgodę przed `npm install @dnd-kit/core @dnd-kit/sortable`. Jeśli użytkownik nie chce nowej zależności, fallback: framer-motion + ręczna logika (droższe, więcej edge-case'ów).

#### Pliki do utworzenia (komponenty max ~100 linii — rozbić)
- `frontend/app/applications/page.tsx` (przepisać: kontener Kanbana, ładuje dane, obsługuje stany)
- `frontend/components/kanban/KanbanBoard.tsx` (DndContext, layout 4 kolumn, handler onDragEnd → PATCH optimistic)
- `frontend/components/kanban/KanbanColumn.tsx` (jedna kolumna: tytuł statusu, licznik na żywo, lista kart, empty ghost-CTA)
- `frontend/components/kanban/KanbanCard.tsx` (firma, rola, match score chip, data; draggable)
- `frontend/components/kanban/KanbanCardGhost.tsx` (empty state kolumny z CTA)
- `frontend/lib/hooks/useApplications.ts` (hook: fetch listy, optimistic status update + rollback, delete, stany loading/error) — TU centralizujemy logikę CRUD (naprawa buga 2 dziedziczona).
- `frontend/lib/kanban.ts` (mapowanie status → kolumna, kolejność kolumn, kolory statusów z tokenów)

#### Kroki
1. **useApplications hook** — jedno źródło stanu aplikacji:
   - `applications`, `loading`, `error`, `updateStatus(id, status)`, `deleteApplication(id)`.
   - `updateStatus`: optimistic (od razu przenieś kartę), `PATCH /applications/{id}` z `{status}`; przy błędzie ROLLBACK do poprzedniego statusu + `error` z komunikatem (#FF3D00 toast/inline). Wykorzystuje naprawiony `api.ts`.
2. **KanbanBoard** — 4 kolumny w kolejności Applied → Interview → Offer → Rejected. `onDragEnd`: jeśli karta upuszczona w innej kolumnie → `updateStatus`. Liczniki kolumn liczone z danych (na żywo).
3. **KanbanColumn** — nagłówek: nazwa statusu (Space Grotesk) + licznik. Puste → `KanbanCardGhost` z CTA (np. "No applications here" + link do /analyse dla Applied). Kolor akcentu kolumny wg statusu (spójny z dawnym StatusBadge, ale z tokenów).
4. **KanbanCard** — firma, rola, match score chip (kolor wg progu: wysoki=neon, niski=danger), data (mono). Draggable handle (cała karta lub uchwyt — zaproponować). Animacja podniesienia (framer-motion `whileDrag` scale/shadow).
5. **Mobile** — kolumny jako **pozioma karuzela** ze snap-scroll (`overflow-x-auto snap-x`), każda kolumna min-width ~80vw. REKOMENDACJA karuzela > akordeon, bo zachowuje mentalny model tablicy i pozwala widzieć licznik/nagłówek kolumny; drag&drop na mobile może być trudny — na mobile dopuścić alternatywę: tap na kartę → menu zmiany statusu (fallback bez drag). **Zatrzymanie:** potwierdzić z użytkownikiem, czy na mobile drag ma działać, czy wystarczy tap-to-change-status.
6. **Loading/error** — skeleton kolumn podczas ładowania; error banner przy błędzie fetch; osobny komunikat przy błędzie PATCH (rollback).

#### Kontrakt API (istniejący, wykorzystywany)
- `GET /applications/` → lista.
- `PATCH /applications/{id}` z body `{status: "Applied"|"Interview"|"Offer"|"Rejected", notes?: string}` → zaktualizowana aplikacja.
- `DELETE /applications/{id}` → 204 (naprawione w api.ts).
- Typy w `lib/api.ts`: upewnić się, że `Application` type ma pola: `id`, `company`, `role`, `status`, `match_score`(?), `created_at`, `job_description`(?). Dodać brakujące zgodnie z backendem (patrz Faza 5 — `job_description` i score dochodzą).

### 3B. Dashboard → editorial

#### Pliki do utworzenia/zmiany
- `frontend/app/dashboard/page.tsx` (przepisać layout: narracja → funnel → ledger → heatmap; USUNĄĆ 4 stat-cardy)
- `frontend/components/dashboard/NarrativeHeader.tsx` (nagłówek Space Grotesk + lead-akapit generowany z danych, liczby z neonowym markerem)
- `frontend/components/dashboard/ConversionFunnel.tsx` (funnel Applied→Interview→Offer, full width)
- `frontend/components/dashboard/ActivityLedger.tsx` (chronologiczny ledger zdarzeń, monospace, hairline'y)
- `frontend/components/dashboard/ContextBar.tsx` (opcjonalny pasek: sparkline tygodni — dawny bar chart zdegradowany)
- `frontend/components/dashboard/NumberMarker.tsx` (inline highlight liczby, markerowa animacja) — mały reużywalny
- `frontend/components/HeatmapGrid.tsx` (zostaje, oczyszczony w Fazie 2)
- `frontend/lib/dashboard.ts` (agregacje: funnel counts, budowa ledgera z aplikacji, dane sparkline z poprawnym sortowaniem dat — reużyć fix z buga 4)

#### Kroki
1. **USUNĄĆ 4 stat-cardy** i stary grid kart. Donut statusów i stage breakdown — logikę przenieść do funnela (nie dublować).
2. **NarrativeHeader** — nagłówek + lead-akapit składany z realnych danych (np. "Wysłałeś **3** aplikacje w tym tygodniu, **1** czeka na rozmowę."). Liczby przez `NumberMarker` (neonowe podświetlenie + markerowa animacja przy wejściu). Jeśli zero danych → empty state z CTA (patrz 3D).
3. **ConversionFunnel** — dominujący, full width. Etapy Applied → Interview → Offer (Rejected pokazać osobno jako "odpadło", nie w lejku, bo to nie kolejny etap). Szerokości segmentów proporcjonalne do liczności. Framer-motion animacja wejścia (rozwijanie szerokości).
4. **ActivityLedger** — lista zdarzeń chronologicznie: data | firma | zdarzenie (np. "status → Interview", "dodano aplikację"). Monospace, hairline separatory (`--color-border`). Źródło zdarzeń: na tym etapie z pól aplikacji (created_at, status). Pełna historia zdarzeń wymagałaby event-logu — jeśli go nie ma, ledger buduje się z dostępnych danych (created_at + aktualny status). **Zatrzymanie/uwaga:** jeśli backend nie zwraca timestampów zmian statusu, ledger pokaże tylko utworzenie + bieżący stan — potwierdzić, czy to wystarczy, czy dorobić event-log (poza zakresem, raczej NIE teraz).
5. **ContextBar / sparkline** — dawny bar chart tygodni jako mały sparkline (recharts) z chronologicznym sortem (fix buga 4). Opcjonalny — jeśli miejsce/wartość wątpliwe, coder może pominąć i zgłosić.
6. **Loading/error** — skeleton (reużyć/rozszerzyć istniejące Skeleton), error state przy błędzie fetch danych.

### 3C. Mikrointerakcje (framer-motion, funkcjonalne)
- Kanban: `whileDrag` (scale/elevation), animacja przeniesienia karty (layout animation) — w KanbanCard.
- **Animacja score po tailorze**: score animuje od starej do nowej wartości (count-up) + chip delty "+9 ▲" (neon jeśli wzrost, #FF3D00 jeśli spadek). Komponent `frontend/components/AnimatedScore.tsx` (~<100 linii), użyty w MatchScore/TailorSection. Wymaga trzymania poprzedniego score (w cv-context lub prop).
- **Markerowa animacja** przy zmianie statusu (kanban card "stempel") i przy podświetleniach liczb w NarrativeHeader (`NumberMarker`).
- Wszystkie animacje respektują `prefers-reduced-motion` (dodać guard — framer-motion `useReducedMotion`).

### 3D. Empty states z CTA
- Dashboard (zero aplikacji): duży empty state "Zacznij od analizy CV" + CTA → /analyse.
- Kanban puste kolumny: `KanbanCardGhost` z CTA.
- /applications istniejący empty state: ujednolicić z powyższymi (wspólny komponent `frontend/components/EmptyState.tsx` ~<100 linii, prop: ikona lucide, tytuł, opis, CTA).

### Ryzyka Fazy 3
- Kanban to najbardziej złożony element — rozbić bezwzględnie na Board/Column/Card/Ghost (limit 100 linii).
- Optimistic update + rollback: łatwo zgubić poprzedni stan przy szybkich akcjach — trzymać snapshot przed mutacją.
- Drag na mobile — realne ryzyko UX, mieć fallback tap-to-change.
- @dnd-kit = nowa zależność → zatrzymanie i zgoda użytkownika.
- Recharts 3 + React 19 — zweryfikować kompatybilność (jeśli błędy renderu, zgłosić).

---

## FAZA 4 — PDF: uporządkowanie

Rekomendacja: **usunąć martwy kod serwerowy PDF + zastąpić klientowski `window.open()+print()` czystym print stylesheetem BEZ window.open.** Uzasadnienie: `/pdf/generate` zawsze zwraca 503 (weasyprint wymaga GTK3 — ciężka zależność systemowa, nierealna w tym środowisku), a `window.open()+window.print()` potrafi zawiesić renderer. Prostsze i pewniejsze: dedykowany print stylesheet (`@media print`) na istniejącej stronie/preview CV, przycisk woła `window.print()` bez otwierania nowego okna. To najprostsze rozwiązanie dające przewidywalny wynik.

### Pliki
- USUNĄĆ: `backend/pdf_templates.py`, endpoint `POST /pdf/generate` w backendzie (main/router), typ w `lib/api.ts` jeśli istnieje.
- ZMIENIĆ: `frontend/components/PdfExportSection.tsx` (usunąć window.open, użyć `window.print()` + `@media print` stylesheet ukrywający UI, pokazujący tylko CVPreview/wybrany layout).
- `frontend/app/globals.css` lub dedykowany `print.css` — reguły `@media print`.
- ZACHOWAĆ bez zmian: `POST /pdf/extract` (pdfplumber + AI clean) i auto-tailor — działają.

### Kroki
1. Usunąć endpoint `/pdf/generate` i `pdf_templates.py`; upewnić się, że nic w backendzie ich nie importuje (jeśli import w main.py — usunąć). Zweryfikować, że `requirements.txt` nie musi już zawierać weasyprint (jeśli był — usunąć, żeby nie blokował instalacji).
2. PdfExportSection: przycisk "Download PDF" → `window.print()` (bez open). 3 layouty: wybór layoutu ustawia klasę na wrapperze, `@media print` renderuje tylko wybrany.
3. `@media print`: ukryć sidebar, nav, przyciski; A4, marginesy, ostre kolory (uwaga: neon #E8FF00 na czerni w druku — rozważyć wariant print-friendly; **zatrzymanie:** potwierdzić z użytkownikiem, czy PDF ma być ciemny czy jasny do druku).
4. Zaktualizować `lib/api.ts` — usunąć martwy typ/wywołanie generate jeśli było.

### Ryzyka
- `window.print()` bez nowego okna drukuje bieżącą stronę — `@media print` MUSI precyzyjnie izolować CV, inaczej wydrukuje się cały dashboard/sidebar.
- Kolory w druku (dark theme → kartka) — decyzja użytkownika.

---

## FAZA 5 — NOWE FUNKCJE: historia analiz + progresja score

### 5A. Backend: tabela `analyses` + endpointy

#### Migracja / schemat
- Nowa tabela `analyses` w `backend/database.py` przez `CREATE TABLE IF NOT EXISTS` (spójnie z istniejącym wzorcem `applications`):
  ```
  analyses(
    id            (PK, gen jak w applications),
    application_id  FK → applications(id) ON DELETE CASCADE,
    overall_score   INT,
    missing_keywords JSONB,
    categories      JSONB (opcjonalnie — 4 kategorie),
    created_at      TIMESTAMPTZ DEFAULT now()
  )
  ```
- `applications` — dodać kolumnę `job_description TEXT` (bug: ApplicationCreate przyjmuje job_description, ale frontend go nie wysyła i tabela może nie mieć kolumny — zweryfikować i dodać przez `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Persystencja job_description umożliwia re-analizę.

#### Endpointy (Pydantic, type hints — konwencja nienegocjowalna)
1. **Zapis analizy przy tworzeniu aplikacji.** Rozszerzyć istniejący `POST /applications/`:
   - `ApplicationCreate` (request): dodać `job_description: str`, `overall_score: int | None`, `missing_keywords: list[str] | None`, `categories: list[CategoryScore] | None` (żeby przy zapisie aplikacji zapisać też pierwszą analizę).
   - Przy create: insert aplikacji + insert pierwszego wiersza `analyses`.
   - Response: `ApplicationResponse` z dołożonym `match_score`/`overall_score` i `job_description`.
2. **POST re-analizy dla istniejącej aplikacji:**
   - `POST /applications/{id}/analyses`
   - Request `ReanalyseRequest`: `{cv: str}` (job_description bierzemy z zapisanej aplikacji; jeśli chcemy nadpisać — opcjonalne `job_description: str | None`).
   - Backend: pobiera `job_description` aplikacji, woła istniejącą logikę `/analyse`, zapisuje nowy wiersz `analyses`, zwraca `AnalysisResponse`.
   - Response `AnalysisResponse`: `{id, application_id, overall_score, missing_keywords: list[str], categories: list[CategoryScore], created_at}`.
3. **GET historii analiz:**
   - `GET /applications/{id}/analyses`
   - Response: `list[AnalysisResponse]` posortowana rosnąco po `created_at` (dla wykresu progresji).
4. Modele Pydantic: `AnalysisResponse`, `ReanalyseRequest`, rozszerzony `ApplicationCreate`/`ApplicationResponse`, reużyć istniejący model kategorii z `/analyse`. Zero surowych dictów.

#### Typy w `lib/api.ts` (odpowiadające)
- `Analysis` = `{ id: string; application_id: string; overall_score: number; missing_keywords: string[]; categories: CategoryScore[]; created_at: string }`.
- Funkcje: `getAnalyses(applicationId): Promise<Analysis[]>`, `reanalyse(applicationId, cv): Promise<Analysis>`, rozszerzyć `createApplication(...)` o job_description + wynik.
- Rozszerzyć typ `Application` o `job_description: string`, `match_score: number | null`.

### 5B. Frontend: widok szczegółu aplikacji + wykres progresji

#### Decyzja: drawer vs strona
Rekomendacja: **osobna strona `/applications/[id]`** (nie drawer).
Uzasadnienie: widok zawiera wykres progresji (recharts), listę analiz i akcję re-analizy (wymaga CV input) — to za dużo na drawer, a osobna strona daje deep-link (można wrócić do konkretnej aplikacji), lepiej działa na mobile i jest zgodna z App Routerem. Klik karty Kanban → nawigacja do `/applications/[id]`. **UWAGA Next 16:** dynamic `params` może być Promise — patrz krok zerowy, coder czyta guide przed implementacją.

#### Pliki do utworzenia
- `frontend/app/applications/[id]/page.tsx` (ładuje aplikację + analizy, stany loading/error)
- `frontend/components/application-detail/AppDetailHeader.tsx` (firma, rola, status, bieżący score)
- `frontend/components/application-detail/ScoreProgressChart.tsx` (recharts line chart progresji `overall_score` w czasie)
- `frontend/components/application-detail/AnalysisList.tsx` (lista analiz: data, score, missing keywords)
- `frontend/components/application-detail/ReanalysePanel.tsx` (CV input + przycisk re-analizy, loading/error, po sukcesie score animuje deltę — reużyć AnimatedScore z 3C)
- rozszerzyć `frontend/components/SaveApplicationModal.tsx` — wysyłać `job_description` + wynik analizy przy zapisie (naprawa: frontend obecnie nie wysyła job_description).

#### Kroki
1. `/applications/[id]/page.tsx`: pobierz aplikację i `getAnalyses(id)`. Loading skeleton, error state. (Next 16: obsłużyć `params` zgodnie z guide.)
2. `ScoreProgressChart`: recharts LineChart, oś X = created_at (chronologicznie — sort z backendu już rosnący), oś Y = overall_score 0–100. Empty/single-point: pokazać pojedynczy punkt lub komunikat "Za mało danych, zrób re-analizę".
3. `AnalysisList`: każdy wpis data (mono) + score chip + missing keywords jako tagi.
4. `ReanalysePanel`: pole CV (reużyć CvInput lub uproszczony textarea), przycisk → `reanalyse(id, cv)`, loading+error, po sukcesie dodać punkt do wykresu (refetch lub optimistic) + animacja delty score.
5. `SaveApplicationModal`: dołożyć wysyłkę `job_description` (z kontekstu analizy) i wyniku (overall_score, missing_keywords, categories) do `createApplication`.

### Ryzyka Fazy 5
- Migracja schematu: `ALTER TABLE ADD COLUMN IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS` — bezpieczne, ale coder ma potwierdzić, że database.py wykonuje te statements przy starcie (spójnie z istniejącym wzorcem). Baza jest współdzielona (brak auth) — żadnych destrukcyjnych migracji (drop/alter type). **Zatrzymanie:** przed jakimkolwiek `DROP`/zmianą typu — zapytać.
- FK `ON DELETE CASCADE`: usunięcie aplikacji kasuje jej analizy — potwierdzić, że to pożądane (tak, logiczne).
- Re-analiza woła Anthropic API (koszt/latencja) — porządny loading state, obsługa błędu AI.
- Kontrakt score: ujednolicić nazwę pola (`overall_score` w AI vs `match_score` w aplikacji) — trzymać jedną konwencję w typach, mapować świadomie.

---

## FAZA 6 — Persystencja cv-context (sessionStorage)

### Pliki
- `frontend/lib/cv-context.tsx` (dodać sync do sessionStorage)

### Kroki
1. Przy zmianie CV / wyników / tailor — zapisać do `sessionStorage` (klucz np. `hireworthy:cv-context`). Przy mount — odczytać i zhydrować stan.
2. Ostrożnie z SSR/hydration (Next): `sessionStorage` tylko po stronie klienta — odczyt w `useEffect`, nie w initial state, żeby uniknąć hydration mismatch. (Next 16 — potwierdzić wzorzec w kroku zerowym.)
3. Powiązać z bugiem 5 (banner "previous results") — po hydracji z storage banner MA się pokazać (to jest "powrót"); po świeżej analizie NIE.
4. sessionStorage (nie localStorage) — świadomie: dane sesyjne, znikają po zamknięciu karty, zgodnie z wymaganiem "przeżywają F5".

### Ryzyka
- Hydration mismatch — najczęstszy błąd. Odczyt w useEffect.
- Rozmiar CV w storage — sessionStorage limit ~5MB, CV tekstowe zmieści się; PDF-extract wynik to tekst, OK.

---

## Kolejność wykonania (podsumowanie faz)

0. Krok zerowy — lektura guide'ów Next 16 (blokujący).
1. Faza 1 — bugfixy krytyczne + env (fundament, aplikacja startuje i działa).
2. Faza 2 — system stylów (spójny fundament wizualny).
3. Faza 4 — PDF cleanup (mały, niezależny, usuwa martwy kod — można wcześnie).
4. Faza 3 — redesign widoków (Kanban, Dashboard, mikrointerakcje, empty states).
5. Faza 5 — nowe funkcje (historia analiz, progresja, detail view).
6. Faza 6 — persystencja cv-context.

(Faza 4 celowo przed Fazą 3 — usuwa martwy kod i upraszcza PdfExportSection zanim dotkniemy widoków; niezależna, niskie ryzyko.)

---

## Globalne miejsca zatrzymania (coder MA zapytać)
1. Dodanie nowych zależności: `@dnd-kit`, ewentualnie `cva`/`clsx` — zgoda przed `npm install`.
2. URL bazy (DATABASE_URL) i klucz Anthropic — dostarcza użytkownik, nie wymyślać.
3. Jakakolwiek destrukcyjna operacja na bazie (DROP/ALTER TYPE) — baza współdzielona.
4. Mobile Kanban: drag&drop vs tap-to-change-status — potwierdzić UX.
5. PDF w druku: dark vs light — potwierdzić.
6. Sidebar hover-expand: jeśli nie da się bez layout-shift/zasłaniania — pokazać warianty.
7. Ledger na dashboardzie: jeśli brak event-logu timestampów zmian statusu — potwierdzić uproszczony zakres.
8. Jeśli guide'ów Next 16 brak w node_modules — zgłosić, nie zgadywać API.

## Konwencje do egzekwowania przez cały czas
- Brak `any`; wszystkie wywołania API przez `lib/api.ts`; komponent max ~100 linii (rozbijać); ikony tylko lucide-react; każde wywołanie API loading+error; Pydantic + type hints w backendzie; zero console.log (tylko console.error w catch); ostre rogi; paleta czerń + #E8FF00 + #FF3D00; Space Grotesk display / Geist body / mono dane.
- Reviewer i test-writer dopisują do `docs/agent-runs/2026-07-02-redesign-audyt-raport.md`.
