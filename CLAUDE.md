# CLAUDE.md

## Co to jest ten projekt

AI-powered Job Application Tracker — full-stack aplikacja webowa, która pozwala użytkownikowi wklejać CV i ogłoszenia o pracę, otrzymywać AI-generowany wynik dopasowania (0-100), listę brakujących słów kluczowych i konkretne sugestie poprawy CV. Aplikacja umożliwia też śledzenie statusu wysłanych aplikacji (Applied → Interview → Offer → Rejected) oraz przeglądanie statystyk na dashboardzie.

**Stack:** Next.js 14 (App Router) + Tailwind (frontend) / FastAPI + Python 3.11 (backend) / PostgreSQL (baza) / Anthropic Claude API (AI).
**Stan:** scaffold gotowy, frontend do zbudowania przez Claude Code, backend działa na in-memory store (wymaga podpięcia PostgreSQL).
**Brak auth** — na tym etapie aplikacja nie ma logowania, wszystkie dane są współdzielone.

## Komendy weryfikujące zmiany

### Backend
```bash
cd backend
source venv/bin/activate        # Windows: venv\Scripts\activate
uvicorn main:app --reload       # dev server na http://localhost:8000
pytest tests/                   # testy (gdy zostaną napisane)
```

### Frontend
```bash
cd frontend
npm run dev                     # dev server na http://localhost:3000
npm run build                   # weryfikacja TypeScript + build produkcyjny
npm run lint                    # ESLint
```

### Baza danych
```bash
docker-compose up db            # odpala PostgreSQL lokalnie na porcie 5432
```

### Sprawdzenie API ręcznie
```bash
# Health check
curl http://localhost:8000/health

# Test analizy CV
curl -X POST http://localhost:8000/analyse/ \
  -H "Content-Type: application/json" \
  -d '{"cv": "Python developer 3 years experience", "job_description": "We need a Python backend developer"}'
```

## Konwencje (nienegocjowalne)

### Python (backend)
- Python 3.11+, type hints wymagane na wszystkich publicznych funkcjach
- Pydantic modele dla wszystkich request/response — nigdy surowe dicts w API
- Zmienne środowiskowe tylko przez `os.getenv()` lub `python-dotenv` — zero hardkodowanych kluczy
- Nazewnictwo plików: `snake_case`
- Importy: najpierw stdlib, potem third-party, potem lokalne — oddzielone pustą linią

### TypeScript (frontend)
- Strict mode włączony (`"strict": true` w tsconfig)
- Żadnych `any` — zawsze właściwy typ lub `unknown`
- Wszystkie wywołania API przez `lib/api.ts` — nigdy `fetch()` bezpośrednio w komponentach
- Komponenty: jeden plik = jeden komponent, max ~100 linii — jeśli więcej, podziel
- Nazewnictwo komponentów: `PascalCase`, plików: `kebab-case`

### Ogólne
- Każde wywołanie API musi mieć obsługę loading state i error state
- Żadnych `console.log` w kodzie produkcyjnym (tylko `console.error` w catch)
- Dark theme: bg `#0f172a`, cards `#1e293b`, borders `#334155`, accent `#6366f1`
- Ikony wyłącznie z `lucide-react`

---

## Pipeline agentów

Do nietrywialnych zmian (nowa funkcjonalność, refaktor, więcej niż jeden plik) używaj subagentów w tej kolejności. Do drobnych, jednoplikowych poprawek możesz pominąć pipeline i zrobić zmianę sam.

1. **explorer** — zmapuj relevantny kod, zwróć podsumowanie konwencji i plików.
2. **planner** — na podstawie podsumowania explorera, zaprojektuj plan. Planner działa w plan mode i **zatrzyma się, czekając na moją akceptację**. Nie przechodź do kodu bez wyraźnego "zatwierdzam" / "ok, działaj" od mnie.
3. **coder** — po akceptacji planu, zaimplementuj kod zgodnie z planem.
4. **reviewer** — krytyczny przegląd zaimplementowanego kodu (błędy, edge case'y, bezpieczeństwo). Nie naprawia, tylko raportuje.
5. **test-writer** — pisze i odpala testy na bazie problemów zgłoszonych przez reviewer. Nie naprawia kodu produkcyjnego, tylko raportuje wykryte bugi.
6. **Ty (główna sesja) naprawiasz** wszystko zgłoszone przez reviewer i test-writer, a następnie pokazujesz mi finalny stan.

Subagenty review/qa są tylko czytelnikami-raporterami. Wszystkie zmiany w kodzie produkcyjnym wprowadza główna sesja albo coder, nigdy reviewer ani test-writer.

### Nazewnictwo pliku raportu

Na początku każdego zadania przechodzącego przez pipeline, wymyśl JEDNĄ nazwę bazową w formacie:
`<YYYY-MM-DD>-<krotki-slug-zadania>`

Przekaż tę samą nazwę bazową każdemu agentowi w pipeline, który zapisuje coś do `docs/agent-runs/`:
- planner zapisuje do `docs/agent-runs/<nazwa-bazowa>-plan.md`
- reviewer i test-writer dopisują kolejne sekcje do `docs/agent-runs/<nazwa-bazowa>-raport.md`

Nie pozwól każdemu agentowi wymyślać nazwy samodzielnie — muszą się zgadzać, bo reviewer i test-writer piszą do tego samego pliku.

---

## Preferencje kodowania i nauka w czasie

Nie zapisuj preferencji kodowania w tym pliku ręcznie poprzez instrukcję typu "dopisz regułę tutaj". Zamiast tego:

- Gdy poprawię Twoje podejście, wybór narzędzia, czy konwencję — **aktywnie zapisz to do auto memory**, nie czekaj tylko na własną ocenę czy to "warte zapamiętania". Korekta użytkownika prawie zawsze jest warta zapamiętania.
- Gdy podejmiesz dobrą decyzję w niejednoznacznej sytuacji i potwierdzę że było słusznie — zapisz to też, z uzasadnieniem "czemu", nie tylko samą regułę.
- Jeśli zauważysz, że jakaś reguła z auto memory jest już nieaktualna (np. zmieniliśmy bibliotekę), zaktualizuj ją, nie zostawiaj sprzecznych wpisów.

Możesz sprawdzić co jest aktualnie zapamiętane komendą `/memory`.

---

## Kiedy się zatrzymać i zapytać

- Przed jakąkolwiek operacją nieodwracalną (force push, usunięcie plików, zmiana w bazie produkcyjnej, publikacja).
- Gdy plan plannera jest niejednoznaczny lub koliduje z czymś co odkryjesz podczas implementacji.
- Gdy reviewer zgłosi problem oznaczony jako Krytyczny — pokaż mi go przed naprawą, nie naprawiaj automatycznie w milczeniu.