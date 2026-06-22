# UI Polish — raport przegladu
Data: 2026-06-22
Pliki: app/layout.tsx, components/Sidebar.tsx, app/page.tsx, components/CvInput.tsx,
       app/review/page.tsx, app/analyse/page.tsx, app/dashboard/page.tsx,
       app/applications/page.tsx, components/StatusBadge.tsx

---

## Krytyczne (blokują działanie)

Brak. Nie znaleziono problemów blokujących działanie aplikacji.

---

## Poważne (zepsują UX)

### 1. Konflikt border-left na wierszach tabeli (applications/page.tsx + globals.css)

Klasa `.accent-row` ustawia `border-left: 2px solid transparent` w CSS.
Jednocześnie styl inline na tym samym elemencie ustawia `padding: "0 16px"`.
Padding jest OK, ale kolumny siatki (`gridTemplateColumns`) są zdefiniowane bez
uwzględnienia tych 2px border-left po lewej, które pojawiają się przy hover.
W rezultacie przy hover cały wiersz minimalnie "skacze w prawo" o 2px, bo border
nie jest wliczony do szerokości — element nie ma `box-sizing: border-box` wymuszony
przez ten konkretny kontener. Tailwind domyślnie stosuje `box-sizing: border-box`
na `*`, więc w praktyce efekt może być niezauważalny, ale warto zweryfikować czy
przy hover content się nie przesuwa.

Plik: `C:\Users\adamk\Desktop\job-tracker\frontend\app\applications\page.tsx` linia 113-123
oraz `C:\Users\adamk\Desktop\job-tracker\frontend\app\globals.css` linia 115-121.

### 2. Mobilny marginLeft na main nie aktualizuje się przy sidebarze dolnym (layout.tsx)

`layout.tsx` (linia 29) ustawia `style={{ marginLeft: "56px" }}` na `<main>`.
Na mobile (max-width 640px) sidebar przechodzi do bottom navigation (pozycja fixed,
bottom: 0, height 56px), wiec `marginLeft: 56px` pozostaje aktywny i niepotrzebnie
zwęża ekran z lewej strony. `globals.css` dodaje `padding-bottom: 72px` dla main na
mobile (linia 152), ale nie zeruje `margin-left`. Na ekranach 320-640px treść jest
przesunięta w prawo o 56px bez powodu.

Plik: `C:\Users\adamk\Desktop\job-tracker\frontend\app\layout.tsx` linia 29.
Fix: dodać `@media (max-width: 640px) { main { margin-left: 0 !important; } }` w
globals.css, lub przenieść marginLeft z inline style do klasy CSS.

### 3. StatusBadge "APPLIED" — niski kontrast tekstu

W `StatusBadge.tsx` (linia 8) status `applied` ma `color: "#666666"` na tle
`background: "#1a1a1a"`. Stosunek kontrastu wynosi ~3.3:1, poniżej wymaganego
4.5:1 dla tekstu małego (WCAG AA). Dla użytkowników z gorszym wzrokiem tekst
"APPLIED" będzie nieczytelny, szczególnie przy rozmiarze 0.65rem i uppercase.

Plik: `C:\Users\adamk\Desktop\job-tracker\frontend\components\StatusBadge.tsx` linia 8.
Fix: zmienić `color` dla `applied` na `"#999999"` lub `"#aaaaaa"`.

---

## Drobne (warto naprawić)

### 4. Brakujący aria-disabled na disabled buttonach (review/page.tsx, analyse/page.tsx)

W `review/page.tsx` (linia 48-66) przycisk "Analyse CV" ma `disabled` jako atrybut HTML,
co jest poprawne — przeglądarka automatycznie dodaje `aria-disabled` dla natywnego
`<button disabled>`. To nie jest błąd. Jednak w `analyse/page.tsx` (linia 86-99)
przycisk również używa natywnego `disabled`, co też jest poprawne.
Nie ma tu problemu z dostępnością — natywny disabled wystarczy.

### 5. Atrybut type brakuje na buttonach-toggle w CvInput.tsx

`CvInput.tsx` linie 106 i 109 — przyciski "Paste text" i "Upload PDF" nie mają
`type="button"`. Jeśli `CvInput` kiedykolwiek zostanie opakowany w `<form>`,
domyślny `type="submit"` spowoduje niechciane wysłanie formularza. Aktualnie
formularz nie istnieje, ale to standardowa praktyka defensywna.

Plik: `C:\Users\adamk\Desktop\job-tracker\frontend\components\CvInput.tsx` linie 106, 109.

### 6. Sidebar: active link dla "/" (strona główna) nigdy nie zaświeci

W `Sidebar.tsx` (linia 63) warunek aktywności to `pathname.startsWith(href)`.
Lista `links` nie zawiera wpisu dla `href: "/"`, więc strona główna nigdy nie
podświetli żadnego elementu nawigacji. To zachowanie może być zamierzone (landing
nie jest częścią nawigacji aplikacyjnej), ale warto upewnić się, że jest to
świadoma decyzja, nie przeoczenie.

Plik: `C:\Users\adamk\Desktop\job-tracker\frontend\components\Sidebar.tsx` linia 15-20.

### 7. Drag-zone w CvInput nie ma role="button" ani tabIndex

Div obsługujący drag-and-drop (linia 141-170 w CvInput.tsx) ma `onClick` ale brak
`role="button"` i `tabIndex={0}`, więc nie jest dostępny klawiaturą. Użytkownicy
nawigujący tabem nie mogą go aktywować. Aktywny toggle "Upload PDF" i `<input
type="file">` są dostępne jako alternatywa, ale sam drop-target nie.

Plik: `C:\Users\adamk\Desktop\job-tracker\frontend\components\CvInput.tsx` linia 141.

---

## OK — wszystko zgodne z planem

- **Bottom CTA sekcja istnieje** w `app/page.tsx` (linie 77-85): tekst + przycisk "REVIEW MY CV" z flex justify-space-between. Plan spełniony.
- **Hover na table row ma border-left** zdefiniowany w `.accent-row:hover` (globals.css linia 119-121). Plan spełniony.
- **Badge "APPLIED" ma tekst** — jest widoczny (choć kontrast za niski, patrz punkt 3 powyżej).
- **Fixed sidebar nie nakłada się na content** — `marginLeft: 56px` na main równa sie szerokości collapsed sidebar. OK na desktop.
- **Brak hook rules violations** — wszystkie hooki (useState, useEffect, useCallback, useMemo) są wywoływane bezwarunkowo, przed jakimkolwiek early return, we wszystkich sprawdzonych komponentach.
- **Brak typów `any`** — wszystkie komponenty używają właściwych typów TypeScript.
- **Loading i error state** obecne we wszystkich stronach z wywołaniami API (review, analyse, dashboard, applications).
- **Ikony wyłącznie z lucide-react** — Loader2, Trash2, CheckCircle2, LayoutDashboard, BriefcaseBusiness, Target, FileSearch. Reguła zachowana.
- **Brak `dangerouslySetInnerHTML`** we wszystkich sprawdzonych plikach.
- **API calls przez lib/api.ts** — żadne komponenty nie wywołują `fetch()` bezpośrednio.
