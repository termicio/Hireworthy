# Plan: poprawa jakości WIZUALNEJ tailored CV (HIREWORTHY)

Data: 2026-07-04
Nazwa bazowa pipeline: `2026-07-04-tailored-cv-wyglad`
(reviewer/test-writer piszą do `docs/agent-runs/2026-07-04-tailored-cv-wyglad-raport.md`)

## Cel

Sprawić, by tailored CV (podgląd A4 w iframe + druk PDF) wyglądało profesjonalnie i dokończenie:
poszczególne wpisy doświadczenia/edukacji mają być wizualnie oddzielone, a stanowisko/firma/daty
wyróżnione hierarchią (waga + rozmiar + odstęp), przy zachowaniu:
- kontraktu API (`tailored_cv` pozostaje `string`),
- formy tekstowej copy-paste-friendly / ATS (bez pełnego markdownu z gwiazdkami),
- mechanizmu druku i `escape()` (bezpieczeństwo XSS — treść usera nigdy do atrybutów HTML),
- ogólnego charakteru 3 layoutów (classic / modern / split),
- poprawnego (nie gorszego niż dziś) renderu STAREGO tekstu CV bez nowej konwencji (fallback heurystyczny).

Klucz rozwiązania: wprowadzić lekki, jawny KONTRAKT STRUKTURY tekstu w pierwszej linii każdego
wpisu, który jednocześnie jest czytelny dla człowieka, ATS i parsera front-endu — a NIE jest markdownem.

## Pliki do zmiany/utworzenia

1. `backend/ai.py` — rozszerzyć `TAILOR_PROMPT` (linie 72-120) i `TAILOR_GENERAL_PROMPT` (122-149)
   o jawną konwencję linii wpisu. Bez zmiany reguły „no markdown fences / no preamble".
2. `frontend/lib/cv-parse.ts` — NOWY plik: wydzielony parser CV (dziś `parseCV` żyje w `CVPreview.tsx`,
   linie 78-109). Dodać typ linii `entry` + detekcję (regex + heurystyka fallback) + rozbicie na
   `{ role, org, dates }`. Wydzielenie odchudza `CVPreview.tsx` (już duży) — zgodnie z limitem ~100 linii.
3. `frontend/components/CVPreview.tsx` — `buildCVFragment()` (152-232): renderowanie nowego typu `entry`
   w 3 layoutach + rewizja skali typograficznej. Import parsera z `lib/cv-parse.ts`.
4. `scratchpad/mock_api.py` (pełna ścieżka:
   `C:\Users\adamk\AppData\Local\Temp\claude\A--Desktop-AI-job-tracker-main\955aaef9-2df1-4fe9-8146-c6f11049802f\scratchpad\mock_api.py`)
   — endpointy `/tailor/` i `/tailor/general` mają zwracać pełne, ustrukturyzowane przykładowe CV w nowej konwencji.
5. (opcjonalnie) `frontend/lib/cv-parse.test.ts` lub odpowiednik — jeśli test-writer zdecyduje; nie w zakresie codera na tym etapie.

## Kontrakt struktury tekstu CV (fundament — ustalić NAJPIERW)

Pierwsza linia każdego wpisu doświadczenia/edukacji ma format:

```
Stanowisko — Firma | Jan 2022 – Mar 2024
```

Reguły kontraktu:
- separator roli od organizacji: em-dash z odstępami ` — ` (U+2014).
- separator przed datami: pipe z odstępami ` | `.
- zakres dat: `Mon YYYY – Mon YYYY` lub `Mon YYYY – Present`; en-dash ` – ` (U+2013) między datami.
- pod linią wpisu następują bullety (`•` / `-` / `*`) opisujące osiągnięcia.
- nagłówki sekcji zostają jak dziś: ALL-CAPS (np. `EXPERIENCE`, `EDUCATION`).
- ZERO markdownu (`**`, `#`, ``` ``` ```), zero preambuły — copy-paste do ATS musi zostać czysty.
- gdy brak daty (np. projekt) — dozwolone `Stanowisko — Firma` bez części `| daty`.
- gdy brak firmy — dozwolone `Stanowisko | daty`.

To jest jednocześnie „ładne dla człowieka" i deterministyczne dla parsera. Pipe i em-dash są
neutralne dla ATS (to zwykłe znaki tekstu, nie formatowanie).

## Kroki implementacji

### Faza 1 — Backend: kontrakt w promptach (`backend/ai.py`)

1. Do `TAILOR_PROMPT` (w sekcji STRICT RULES, przed regułą o „ONLY the full rewritten CV text")
   dopisać blok o strukturze wpisu. Proponowane brzmienie (EN, spójne ze stylem STRICT RULES):

   ```
   ENTRY FORMATTING (experience & education):
   - Start every job or education entry with a single header line in this exact shape:
       Job Title — Company | Mon YYYY – Mon YYYY
     Use an em dash " — " between the title and the company, and a pipe " | " before the dates.
   - Use an en dash " – " inside the date range. Use "Present" for ongoing roles
     (e.g. "Jan 2023 – Present"). Abbreviate months to three letters (Jan, Feb, Mar, ...).
   - If a date is unknown, omit the " | ..." part. If there is no company, omit the " — Company" part.
   - Put achievements on the following lines as bullet points starting with "• ".
   - Keep SECTION titles in ALL CAPS on their own line (EXPERIENCE, EDUCATION, SKILLS, ...).
   - Do NOT use markdown (no **, no #, no backticks). Output plain text only.
   ```

2. Ten sam blok (dostosowany 1:1) dopisać do `TAILOR_GENERAL_PROMPT`.
3. NIE zmieniać istniejącej reguły „ONLY the full rewritten CV text — no explanations, no preamble,
   no markdown fences" — nowy blok ją doprecyzowuje, nie kasuje.
4. Zachować type hints (funkcje publiczne w `ai.py`), kolejność importów bez zmian.

STOP dla codera po Fazie 1: pokazać główną sesji dokładne finalne brzmienie obu bloków przed przejściem dalej
(brzmienie promptu wpływa na całość — warto potwierdzić słownictwo/kolejność reguł).

### Faza 2 — Parser: `frontend/lib/cv-parse.ts` (nowy plik)

5. Przenieść logikę `parseCV` z `CVPreview.tsx` do `lib/cv-parse.ts`. Wyeksportować:
   - typy linii (rozszerzony union): `'header' | 'entry' | 'bullet' | 'body'`.
   - typ dyskryminowany dla entry, np.:
     ```ts
     type CVLine =
       | { kind: 'header'; text: string }
       | { kind: 'entry'; role: string; org: string | null; dates: string | null }
       | { kind: 'bullet'; text: string }
       | { kind: 'body'; text: string };
     ```
   - funkcję `parseCV(raw: string): CVLine[]`.
   - strict TS, zero `any`. Regexy jako moduł-level `const` z komentarzem.

6. Detekcja `header` — bez zmian względem dziś: ALL-CAPS krótka linia (<60 zn.) lub linia podkreślenia `----`.
   (header musi być sprawdzany PRZED entry, bo `EXPERIENCE` nie może wpaść jako entry).

7. Detekcja `bullet` — bez zmian: linia zaczynająca się od `•` / `-` / `*` (po trim).
   (bullet sprawdzany przed entry — myślnik listy `-` nie może być mylony z em-dash roli).

8. Detekcja `entry` — dwie ścieżki:

   Ścieżka A (konwencja z promptu — pewna):
   - regex daty (do wielokrotnego użytku):
     ```
     DATE_RANGE = /(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\.?\s*)?\d{4}\s*[–-]\s*(?:Present|Current|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\.?\s*)?\d{4})/i
     ```
   - jeśli linia zawiera ` — ` (em-dash) LUB ` | ` — potraktuj jako entry i rozbij:
     - split po ` | ` → część przed = „role+org", część po = `dates` (o ile pasuje do `DATE_RANGE`, inaczej `dates=null` a fragment doklej do org).
     - „role+org" split po pierwszym ` — ` → `role`, `org`. Brak em-dash → całość to `role`, `org=null`.

   Ścieżka B (fallback heurystyczny — dla CV wklejanych bez konwencji):
   - linia NIE jest header/bullet ORAZ:
     (i) kończy się wzorcem `DATE_RANGE` (data na końcu), LUB
     (ii) po tej linii NASTĘPUJE bullet (kolejna niepusta linia to bullet), a bieżąca linia jest
         krótka (np. ≤ ~80 zn.) i nie zawiera kropki kończącej zdanie w środku (odsiew akapitów).
   - rozbicie fallback:
     - jeśli jest data na końcu → `dates` = dopasowanie `DATE_RANGE`, reszta przed nią to „role+org";
       spróbuj rozbić „role+org" po separatorach `,` / ` at ` / ` – ` / `|`; jak się nie da → całość `role`.
     - jeśli brak daty (ścieżka ii) → `role` = cała linia, `org=null`, `dates=null`.

   Uwaga na kolejność: header → bullet → entry(A) → entry(B) → body (reszta).

### Faza 3 — Renderer w `CVPreview.tsx` (`buildCVFragment`, 3 layouty)

9. Zaimportować `parseCV` i typy z `lib/cv-parse.ts`; usunąć lokalną kopię parsera.
10. Dodać render gałęzi `entry`. Wszystkie pola przez `escape()` (role, org, dates) — nigdy do atrybutów,
    tylko jako tekst wewnątrz elementów. Zachować istniejącą funkcję `escape()`.

11. Specyfikacja typografii wpisu (px w skali dokumentu A4 — te same jednostki co dziś body=10px):

    Wspólne dla wpisu (wszystkie layouty):
    - blok wpisu: `margin-top: 12px` (pierwszy w sekcji: 6px), `margin-bottom: 2px`.
    - linia nagłówka wpisu = flex, `justify-content: space-between; align-items: baseline; gap: 8px`.
    - lewa strona: `role` — `font-weight: 700; font-size: 11px`; `org` — `font-size: 10.5px` w kolorze
      muted (użyj istniejącej zmiennej muted danego layoutu; jeśli brak — `#475569` na jasnym tle druku).
      role i org w jednej linii oddzielone stałym separatorem wizualnym (np. role, potem `, org`
      lub org poniżej — patrz per layout niżej).
    - `dates` — `font-size: 9.5px; font-weight: 500; white-space: nowrap;` wyrównane do prawej (`margin-left:auto`).
    - bullety wpisu: `margin-top: 3px`, wcięcie jak dziś, `line-height: 1.35`.

    Skala globalna do rewizji (zasada „nie wszystko 10px"):
    - body: 10 → 10.5px, `line-height: 1.4`.
    - nagłówek sekcji: zostaje 11px CAPS + linia; zwiększyć `margin-top` sekcji do ~16px dla oddechu.
    - imię: 26px zostaje (jeden mocny akcent — restraint).

    Różnice per layout (zachować charakter):
    - `classic` (serif): `org` italic w tej samej linii co role (`role — <i>org</i>`); `dates` serif,
      tabular/oldstyle jeśli dostępne; separator sekcji cienką linią jak dziś.
    - `modern`: role bold sans, `org` w osobnym mniejszym wierszu pod role (`font-size:10px; muted`),
      `dates` po prawej w linii role; akcent koloru tylko na nazwie sekcji/imieniu (bez kolorowania role).
    - `split` (dwukolumnowy): entry renderowane w kolumnie głównej; `dates` w tej samej linii role po prawej
      krawędzi kolumny głównej (nie globalnej strony) — użyć `margin-left:auto` wewnątrz kolumny.

12. Upewnić się, że TEN SAM fragment nadal zasila iframe-preview (skala 0.38) i print-portal
    `#pdf-print-root` (@media print, jasne tło). Kolory muted muszą mieć wystarczający kontrast na
    jasnym tle druku (nie używać jasnych szarości <#64748b na białym).

13. Pilnować limitu ~100 linii komponentu: jeśli po zmianach `CVPreview.tsx` przekracza, wydzielić
    funkcje renderujące layouty do osobnego helpera (np. `lib/cv-render.ts`) zwracającego string HTML.
    (parser już wyjęty w Fazie 2 pomaga.)

### Faza 4 — Mock (`scratchpad/mock_api.py`)

14. `/tailor/` i `/tailor/general` mają zwracać pełne przykładowe CV w nowej konwencji zamiast sklejki wejścia.
    Zawartość przykładu (jeden realistyczny string, `\n`-separated):
    - linia imienia + kontakt,
    - `SUMMARY` (2-3 zdania body),
    - `EXPERIENCE` z 2-3 wpisami w formacie `Role — Company | Mon YYYY – Mon YYYY` + po 2-3 bullety każdy
      (co najmniej jeden z `– Present`),
    - `EDUCATION` z 1 wpisem w tej samej konwencji,
    - `SKILLS` jako body/lista.
    - dołożyć jeden wpis-edge: bez daty (tylko `Role — Company`) oraz jeden bez firmy (`Role | daty`),
      żeby wizualnie zweryfikować fallbacki renderera.
    - kontrakt odpowiedzi bez zmian: pole `tailored_cv` typu string.

### Faza 5 — Weryfikacja

15. Odpalić front na mocku, sprawdzić iframe-preview i druk (`#pdf-print-root`) we WSZYSTKICH 3 layoutach:
    - wpisy wizualnie oddzielone, role pogrubione, org muted, daty po prawej,
    - stary tekst CV (bez konwencji) wklejony ręcznie — nadal czytelny (fallback), brak regresji.
16. STOP dla codera: JEDNO opcjonalne realne wywołanie `/tailor` tylko za wyraźną zgodą użytkownika
    (minimalny budżet AI). Domyślnie NIE wołać realnego API.

## Ryzyka i na co uważać

- Fałszywe pozytywy heurystyki (Ścieżka B): akapit summary kończący się rokiem (np. „...since 2020")
  może zostać wzięty za entry. Mitigacja: w ścieżce (i) wymagać, by `DATE_RANGE` był ZAKRESEM
  (dwie daty lub `Present`), nie pojedynczym rokiem; w ścieżce (ii) ograniczyć długością i wykluczyć
  linie z kropką-kropką w środku (pełne zdania).
- Kolejność detekcji krytyczna: header i bullet MUSZĄ być przed entry, inaczej `EXPERIENCE` albo
  `- bullet z myślnikiem` wpadną jako entry. Sprawdzić na testach.
- En-dash vs hyphen: prompt każe en-dash ` – `, ale użytkownik/stary CV używa `-`. Regex dat musi
  akceptować oba (`[–-]`). Split roli po em-dash ` — ` (U+2014) — nie mylić z en-dash dat.
- Escape/XSS (reviewer I7): `role`, `org`, `dates` to treść usera/AI — renderować wyłącznie jako
  tekst przez `escape()`, NIGDY do atrybutów (title, style z interpolacją itd.). Nie budować
  `style="...${userValue}..."`.
- Kontrast na druku: muted color czytelny na białym tle print-portalu (min ~#475569), a jednocześnie
  ok w ciemnym iframe. Jeśli kolory są zależne od theme, zweryfikować obie ścieżki (preview vs print).
- Limit ~100 linii komponentu (CLAUDE.md): CVPreview już duży — wydzielić parser (Faza 2) i w razie
  potrzeby renderer; nie rozdmuchać pliku.
- Regresja starych CV: cel — „nie gorzej niż dziś". Jeśli fallback nie rozpozna wpisu, linia trafia do
  `body` (jak obecnie) — akceptowalne, ma NIE psuć układu.
- Turbopack cache (memory): przy niewidocznych zmianach CSS/renderu usunąć `frontend/.next` i zrestartować dev server.
- Skala 0.38 w iframe: rozmiary px podane w skali dokumentu; sprawdzić, że 9.5px dat nie znika po przeskalowaniu
  (to problem tylko podglądu, druk renderuje 1:1).

## Miejsca do zatrzymania codera (STOP)

1. Po Fazie 1 — potwierdzić z użytkownikiem finalne brzmienie obu bloków promptu.
2. Przed jakimkolwiek realnym wywołaniem `/tailor` (Faza 5, krok 16) — tylko za wyraźną zgodą (budżet AI).
