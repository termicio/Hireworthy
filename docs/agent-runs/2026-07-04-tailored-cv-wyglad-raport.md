# Raport: poprawa jakości wizualnej tailored CV (HIREWORTHY)

Nazwa bazowa pipeline: `2026-07-04-tailored-cv-wyglad`

---

## Implementacja (coder)

### Poprawka użytkownika do planu (zastosowana)

Plan pierwotny zakładał kontrakt pierwszej linii wpisu w formacie
`Stanowisko — Firma | Mon YYYY – Mon YYYY` (jedna linia, pipe przed datami).
Użytkownik nadpisał to przed implementacją: kontrakt to teraz **dwie osobne linie**:

```
Firma — Stanowisko
Jan 2022 – Mar 2024
```

Linia 1 = `Organizacja — Rola` (em dash, U+2014, z odstępami). Linia 2 = WYŁĄCZNIE
zakres dat, bez żadnego innego tekstu. Ta zmiana została zastosowana konsekwentnie
w promptach, parserze i mocku (patrz niżej). Nie użyto formatu z pipe (`|`) przed datami.

### 1. `backend/ai.py`

Dodano identyczny (dostosowany do kontekstu) blok `ENTRY FORMATTING` do
`TAILOR_PROMPT` i `TAILOR_GENERAL_PROMPT`, wstawiony bezpośrednio przed sekcją
`STRICT RULES` w obu promptach. Finalne brzmienie bloku (identyczne w obu
promptach):

```
ENTRY FORMATTING (experience & education):
- Start every job or education entry with a header line containing ONLY the organisation
  and the role/degree, in this exact shape:
    Company — Job Title
  Use an em dash " — " between the company (or school) and the role. If there is no
  company (e.g. a personal project), omit the " — Company" part and keep just the title.
- Put the employment (or study) dates ALONE on the very next line, with nothing else on it:
    Mon YYYY – Mon YYYY
  Use an en dash " – " inside the range, and "Present" for ongoing roles
  (e.g. "Jan 2023 – Present"). Abbreviate months to three letters (Jan, Feb, Mar, ...).
  If no date is known, omit this line entirely.
- Put achievements on the following lines as bullet points starting with "• ".
- Keep SECTION titles in ALL CAPS on their own line (EXPERIENCE, EDUCATION, SKILLS, ...).
- Do NOT use markdown (no **, no #, no backticks). Output plain text only.
```

Reguła istniejąca "Return ONLY the full rewritten CV text — no explanations, no
preamble, no markdown fences" pozostała bez zmian (blok ją doprecyzowuje, nie
zastępuje). Type hints i kolejność importów w pliku bez zmian — edycja czysto
tekstowa wewnątrz stałych `str`.

Zgodnie z poleceniem użytkownika ("STOP z planu na potwierdzenie brzmienia jest
ZDJĘTY") nie zatrzymywałem się po tej fazie na potwierdzenie słownictwa.

### 2. `frontend/lib/cv-parse.ts` (nowy plik)

Wydzielony z `CVPreview.tsx` parser CV. Eksportuje:
- `type CVLine` — dyskryminowany union: `header | entry | bullet | body`, gdzie
  `entry` ma pola `{ org: string | null; role: string; dates: string | null }`.
- `interface ParsedCV { name; title; lines: CVLine[] }`.
- `interface Section { header: string | null; lines: CVLine[] }`.
- `parseCV(cvText: string): ParsedCV`.
- `groupSections(parsed: ParsedCV): Section[]` (wcześniej lokalna funkcja w
  `CVPreview.tsx`, przeniesiona bo używana tylko przy renderowaniu layoutu `split`,
  ale operuje na wyjściu parsera więc logicznie należy do tego samego modułu).

Detekcja `name`/`title` (funkcje `detectName`/`detectTitle`) przeniesiona bez
zmian funkcjonalnych z oryginalnego `CVPreview.tsx`.

**Regexy detekcji dat** (moduł-level `const`, z komentarzem):

```ts
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?";
const DATE_TOKEN = `(?:${MONTH}\\s*)?\\d{4}`;
const DATE_RANGE = new RegExp(`${DATE_TOKEN}\\s*[–-]\\s*(?:Present|Current|${DATE_TOKEN})`, "i");
const DATE_RANGE_AT_END = new RegExp(`(${DATE_RANGE.source})\\s*$`, "i");
const DATE_ONLY_LINE = new RegExp(`^\\s*${DATE_RANGE.source}\\s*$`, "i");
const EM_DASH_SEP = " — ";
```

`DATE_RANGE` wymaga zawsze **zakresu** (dwa tokeny, albo token + Present/Current)
— nigdy pojedynczego roku, zgodnie z ryzykiem z planu ("akapit kończący się
rokiem nie może zostać wzięty za wpis"). Akceptuje zarówno en-dash `–` jak i
zwykły hyphen `-` między datami (`[–-]`), bo stare/wklejane CV używają hyphena.

**Kolejność detekcji w pętli `parseCV`** (krytyczna, zgodnie z planem):
1. `header` (ALL CAPS lub linia z podkreśleniem `---`/`===`) — sprawdzane jako pierwsze.
2. `bullet` (`•`/`-`/`*` na początku linii) — sprawdzane przed entry.
3. **Path A** (nowa konwencja, pewna):
   - a) bieżąca linia (krótka, nie wygląda jak zdanie — patrz `looksLikeSentence`
     niżej) + następna linia to WYŁĄCZNIE `DATE_RANGE` (`DATE_ONLY_LINE`) → `entry`
     z `dates` z tej następnej linii. Rozbicie linii 1 przez `splitOrgRole` po
     pierwszym ` — ` (brak em-dash → cała linia to `role`, `org=null` — pokrywa
     przypadek "brak firmy").
   - b) linia zawiera ` — ` i następna linia to bullet (ale NIE jest datą) → `entry`
     bez dat (`dates: null`) — pokrywa przypadek "brak daty".
4. **Path B** (fallback heurystyczny, stary format):
   - c) linia kończy się wzorcem `DATE_RANGE_AT_END` (data na końcu, stary
     format jednoliniowy) → `entry`, reszta linii rozbita przez
     `splitOrgRoleFallback` (próbuje em-dash, potem `" at "`, potem przecinek).
   - d) brak trailing date, ale następna linia to bullet, bieżąca linia krótka
     (≤80 znaków) i nie wygląda jak zdanie → `entry` bez firmy/dat (rola = cała linia).
5. Reszta → `body` (bez zmian względem dziś).

**Heurystyki pomocnicze dodane, żeby ograniczyć fałszywe pozytywy** (poza tym co
było w oryginalnym planie, konieczne do wykrytego podczas implementacji problemu):
- `looksLikeSentence(line)` — odrzuca jako entry-kandydata linie z wewnętrzną
  kropką-końca-zdania (`"...done. Next..."`) lub kończące się kropką. Przed
  sprawdzeniem usuwa krótkie skróty tytułów naukowych (`B.Sc.`, `M.Sc.`, `Ph.D.`,
  `B.A.`, ...) przez `DEGREE_ABBREVIATION`, inaczej `"B.Sc. Computer Science"`
  (typowa linia edukacji) fałszywie wyglądałaby jak zdanie i trafiałaby do `body`
  zamiast `entry`. To wykryte podczas implementacji ryzyko, nieopisane wprost w
  planie — zgłaszam je tutaj zamiast cichej decyzji.
- `MAX_FALLBACK_ENTRY_LEN = 80` — limit długości linii dla ścieżek fallback (3b, 3d),
  zgodnie z planem ("linie ≤ ~80 zn.").

Uwaga dla reviewera: gałąź Path A (3a) wymaga TAKŻE krótkości i "nie-zdania" dla
linii poprzedzającej datę-samodzielną — dodane zabezpieczenie ponad plan, bo
inaczej dowolny akapit `body` przypadkowo poprzedzający linię-samym-rokiem
(rzadkie, ale możliwe w wklejanych CV) zostałby wzięty za entry.

### 3. `frontend/lib/cv-render.ts` (nowy plik)

Plan przewidywał wydzielenie renderera do osobnego helpera "jeśli `CVPreview.tsx`
przekracza limit ~100 linii" — po dodaniu renderu `entry` w 3 layoutach plik
zdecydowanie by przekroczył limit, więc wydzielono `buildCVFragment` (oraz
`buildPreviewHtml`, `buildPrintFragment`, `escape`, funkcje pomocnicze layoutu)
do `frontend/lib/cv-render.ts`. Logika 1:1 z oryginału dla `header`/`bullet`/`body`,
plus nowa funkcja `renderLine()` obsługująca `entry`.

**Typografia wpisu (`renderLine`, gałąź `entry`)** — wspólne dla layoutów:
- `role`, `org`, `dates` przechodzą przez `escape()` — nigdy do atrybutów HTML,
  tylko jako tekst wewnątrz elementów (styl inline budowany WYŁĄCZNIE ze stałych
  kolorów/rozmiarów, nigdy z interpolacją treści użytkownika w `style="..."`).
- blok wpisu: `margin-top: 13px` (zbliżone do planowanych 12-14px), `margin-bottom: 2px`.
- `dates`: `font-size: 9.5px; font-weight: 500; color: #475569` (muted, kontrast
  wystarczający na białym tle druku — patrz sekcja "Kontrast" niżej), `letter-spacing: 0.02em`,
  `white-space: nowrap`. Zgodnie z poprawką użytkownika, renderowane w OSOBNEJ
  linii pod org/role — **nie** `margin-left:auto` / flex-do-prawej (to było
  wymagane tylko w pierwotnym planie z jedną linią; poprawka użytkownika
  jednoznacznie mówi "wyrównane DO LEWEJ pod firmą").
- bullet wpisu: `margin-top: 3px` (globalnie zmienione z 4px→3px), `line-height: 1.35`.

Różnice per layout (zachowany charakter):
- `classic`: `Company — <i>Role</i>` w jednej linii (rola italic, serif), `font-weight:700`
  na całej linii poza kursywą roli.
- `modern` / `split`: `Company` bold w jednej linii, `Role` w osobnej mniejszej
  linii pod spodem (`font-size:10px`, muted `#475569`) — zgodnie z planem dla
  `modern` (rozszerzone też na `split`, bo plan nie precyzował inaczej dla split
  poza pozycją `dates`, a "role pod company" jest spójniejsze z resztą specyfikacji
  niż duplikowanie stylu classic).

Skala globalna zrewidowana zgodnie z planem: `body` 10px → 10.5px (`line-height:1.4`),
nagłówki sekcji `margin-top` 20px → 18px (plan sugerował ~16px; zaokrąglono w górę
dla spójności z odstępem 13px bloku wpisu — różnica nieistotna wizualnie).
Imię zostało 26px bez zmian (plan: "jeden mocny akcent — restraint").

Ten sam fragment (`buildCVFragment`) nadal zasila zarówno iframe-preview
(`buildPreviewHtml`, skala 0.38) jak i print-portal (`buildPrintFragment`,
`#pdf-print-root`) — brak duplikacji logiki między ścieżkami.

### 4. `frontend/components/CVPreview.tsx`

Zredukowany do czystego komponentu prezentacyjnego (~52 linie): importuje
`buildPreviewHtml`/`buildPrintFragment` z `lib/cv-render.ts` i re-eksportuje je
(potrzebne, bo `frontend/components/PdfExportSection.tsx` importuje te dwie
funkcje z `@/components/CVPreview` — **nie zmieniałem** `PdfExportSection.tsx`,
zgodnie z zakresem "NIE ruszaj" z polecenia; re-export zachowuje istniejący
kontrakt importu bez zmian w konsumencie). Reszta komponentu (iframe, skalowanie,
style) bez zmian względem oryginału.

### 5. Mock (`scratchpad/mock_api.py`)

`/tailor/` i `/tailor/general` zwracają teraz identyczny pełny przykładowy CV
(`SAMPLE_TAILORED_CV`) w nowej konwencji zamiast sklejki `req.cv + "[TAILORED]..."`.
Zawiera:
- imię + tytuł + kontakt (email, telefon, LinkedIn),
- `SUMMARY` (3 zdania, body),
- `EXPERIENCE` z 4 wpisami:
  1. Netguru — Backend Developer, `Jan 2023 – Present` (edge: Present),
  2. Allegro — Python Developer, `Jun 2021 – Dec 2022` (pełny zakres),
  3. `Freelance Booking API (personal project)` (BEZ firmy — cała linia to rola),
     `Mar 2021 – May 2021` (edge: brak firmy),
  4. `CD Projekt — Backend Developer Intern` BEZ linii dat (edge: brak daty),
- `EDUCATION` z 1 wpisem: `Lodz University of Technology — B.Sc. Computer Science`
  + `2018 – 2021` (weryfikuje też heurystykę `looksLikeSentence`/`B.Sc.` opisaną wyżej),
- `SKILLS` jako linia body z listą technologii.

Kontrakt odpowiedzi bez zmian (`{"tailored_cv": "<string>"}`).

---

## Co NIE zostało zmienione (zgodnie z zakresem)

- Kontrakty API (`models.py`, request/response schematy) — nietknięte.
- Mechanizm druku / `#pdf-print-root` / `PdfExportSection.tsx` — nietknięte poza
  zachowaniem identycznego importu przez re-export w `CVPreview.tsx`.
- Funkcja `escape()` — logika bez zmian, tylko przeniesiona do `cv-render.ts`.
- Ogólny charakter 3 layoutów (classic/modern/split) — zachowany, zmieniono
  tylko renderowanie wpisów `entry` i drobną rewizję skali typograficznej.

## Na co uważać przy weryfikacji (reviewer / test-writer)

1. **Brak uruchomienia frontendu w tej sesji** — nie mam dostępu do Bash, więc
   `npm run build` / `npm run lint` / wizualna weryfikacja w przeglądarce
   (iframe-preview + druk, wszystkie 3 layouty, mock z `/tailor/`) NIE zostały
   wykonane. To do zrobienia przez agenta test-writer / główną sesję.
2. Zweryfikować, że `frontend/lib/cv-parse.ts` faktycznie kompiluje się w strict
   TS bez `any` — sam kod nie używa `any`, ale nie uruchomiłem `tsc`.
3. Sprawdzić wizualnie fallback dla STAREGO tekstu CV (bez nowej konwencji,
   np. `PDF extract` z mocka: `"Jan Kowalski\nPython Developer\n\nExperience:\n-
   Built FastAPI services for 3 years\n..."`) — te linie z pojedynczym myślnikiem
   NIE mają zakresu dat i nie kończą się datą, więc powinny trafić do `bullet`
   (bo zaczynają się od `-`), nie `entry` — do zweryfikowania w przeglądarce.
4. `looksLikeSentence` + `DEGREE_ABBREVIATION` to nowa heurystyka nieopisana
   dosłownie w planie (patrz sekcja wyżej) — warto ją przetestować na dodatkowych
   przykładach (np. `"M.A. English Literature"`, `"Ph.D. Candidate"`) pod kątem
   fałszywych negatywów/pozytywów.
5. Kontrast `#475569` na białym tle druku — zgodny z dolnym progiem z planu
   (min ~#475569), ale nie zweryfikowany wizualnie/z narzędziem kontrastu.
6. Żadne prawdziwe wywołanie `/tailor` (realny AI) NIE zostało wykonane —
   zgodnie z poleceniem, budżet AI nie był naruszony.

---

## Poprawki po decyzjach użytkownika (główna sesja)

Decyzje użytkownika po obejrzeniu trzech layoutów:
1. **Ujednolicenie wpisu**: `Firma — Stanowisko` w JEDNEJ linii we wszystkich layoutach (firma 700/11px; stanowisko 400 — italic w classic, muted #475569 w modern), data zawsze w osobnej linii pod spodem.
2. **Layout "split" usunięty w całości** (ocena użytkownika: brzydki).

Zmiany:
- `frontend/lib/cv-render.ts` — zunifikowany renderLine dla entry; usunięta cała gałąź split (kolumny 30/70, accentBg, LEFT_KEYWORDS, RIGHT_ORDER, sectionRightOrder).
- `frontend/lib/api.ts` — `PDFLayout = "classic" | "modern"`.
- `frontend/components/PdfExportSection.tsx` — selektor layoutów bez "split".
- `frontend/lib/cv-parse.ts` — usunięte martwe `Section`/`groupSections` (używane tylko przez split).

Weryfikacja: lint+build exit 0; struktura DOM w obu layoutach potwierdzona (`Netguru — <span>Backend Developer</span>` jedna linia, data 9.5px pod spodem, zero pozostałości kolumn split).

## Status przeglądu (reviewer)

Reviewer (Code Reviewer) uderzył w limit sesji konta po 10 tool-callach, ZANIM wyprodukował findings (reset limitu 16:00). Sekcja "Przegląd kodu (reviewer)" NIE powstała — do ponowienia po resecie limitu albo do świadomego pominięcia. Weryfikacja główna sesji objęła: XSS (cała treść przez escape(), nic w atrybutach — potwierdzone w DOM), runtime obu layoutów, regresję starego formatu, edge case'y (Present/brak firmy/brak dat).

## Otwarte

- Jedno realne wywołanie /tailor (Sonnet) dla potwierdzenia, że model trzyma konwencję ENTRY FORMATTING — czeka na zgodę użytkownika (budżet).
- Ewentualne ponowienie reviewera po 16:00.

---

## Weryfikacja na żywym Claude API (główna sesja)

Wykonano 2 realne wywołania /tailor/general (Sonnet), za zgodą użytkownika:

1. **Wywołanie 1 — zmarnowane przez środowisko:** backend na porcie 8000 serwował prompt SPRZED zmian — `uvicorn --reload` nie widzi zmian plików na dysku A: (ta sama przyczyna co cache Turbopacka). Dodatkowo port 8000 okazał się nie do odzyskania (socket-duch z nieistniejącym PID). Obejście: świeży backend na porcie 8001 + tymczasowy `frontend/.env.local` z NEXT_PUBLIC_API_URL (po teście usunięty).
2. **Wywołanie 2 — sukces:** Claude z nowym promptem ENTRY FORMATTING przepisał celowo "zlepione" CV (prace opisane prozą) dokładnie do konwencji: `Softhouse — Software Developer` / `2021 – 2024` / bullety; `CD Projekt — Software Development Intern` / `2020`; `Lodz University of Technology — Bachelor of Science in Computer Science` / `2021`.

Poprawki parsera wynikłe z realnych danych:
- **Garda anty-"2020"**: linia przed bulletami musi zawierać ≥3 litery, żeby zostać wpisem (fallback path B) — samotny rok nie jest już pogrubiany jako nagłówek wpisu.
- **Wariant single-year**: `Uczelnia — Kierunek` + samotny rok pod spodem staje się wpisem TYLKO gdy linia wyżej zawiera em-dash konwencji (edukacja z rokiem ukończenia); goły rok po dowolnej linii pozostaje body (anty-false-positive).

Weryfikacja końcowa (offline, na zapisanym realnym wyniku Claude'a): wszystkie trzy wpisy renderują się jako `**Org** — Rola` + data pod spodem; build/lint exit 0.

**WAŻNE dla użytkownika:** backend uruchomiony przez start-dev.bat NIE przeładowuje się po zmianach kodu na tym dysku mimo --reload — po każdej zmianie w backend/ trzeba zamknąć okno backendu i odpalić start-dev.bat ponownie. Aktualnie działający proces na porcie 8000 ma STARY prompt tailora — wymaga restartu (patrz niżej).
