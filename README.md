# Hireworthy — Know exactly where your CV stands

AI-powered CV review and job-match analysis. Paste a CV, get an honest score with a
section-by-section breakdown, see how you match against a specific job posting, let the
AI rewrite your weak bullet points, and track every application through to the offer.

Built with Next.js 16, FastAPI and the Anthropic Claude API.

> **Note:** the app has no authentication yet. All data is shared across visitors, so
> only run it locally or behind your own access control. See [Limitations](#limitations).

---

## Features

| Page | What it does |
|---|---|
| **Review CV** | Scores your CV 0-100 across clarity, completeness, impact language and ATS-friendliness. Returns your 3 weakest bullet points with rewrites, red flags, and 3 highest-impact quick wins. |
| **Match to Job** | Scores CV vs. a job description across skills, experience relevance, seniority and education fit. Lists matched and missing keywords with per-category evidence. |
| **Auto-Tailor** | Rewrites the CV against a specific posting — restructures for ATS parsers and strengthens bullets, without inventing experience that isn't in the original. |
| **Applications** | Kanban board (drag & drop) tracking Applied → Interview → Offer → Rejected. |
| **Application detail** | Re-run the analysis as your CV evolves and watch the score move on a progress chart. |
| **Dashboard** | Activity heatmap, conversion funnel, weekly sparkline and an activity ledger. |

Input is a pasted CV or an uploaded PDF. PDF extraction handles multi-column and sidebar
layouts by detecting column gutters from word density, then a fast Claude Haiku pass
repairs extraction artifacts before analysis. Tailored CVs export to PDF in two layouts.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS 4 |
| UI | shadcn-style components, Framer Motion, Recharts, dnd-kit, lucide-react |
| Backend | FastAPI, Python 3.11, Pydantic v2 |
| Database | PostgreSQL (asyncpg) — local Docker or Supabase |
| AI | Anthropic Claude (Sonnet for analysis, Haiku for text cleanup) |
| PDF | pdfplumber (extraction), client-side print rendering (export) |

## Project structure

```
.
├── backend/
│   ├── main.py                 # FastAPI app — real Postgres
│   ├── main_mock.py            # Same app, in-memory store (no database needed)
│   ├── mock_applications.py    # In-memory stand-in for the applications router
│   ├── config.py               # CORS origins from env
│   ├── database.py             # asyncpg pool + schema bootstrap
│   ├── models.py               # Pydantic request/response models
│   ├── ai.py                   # Claude prompts and calls
│   ├── routes/
│   │   ├── applications.py     # CRUD + analysis history
│   │   ├── analyse.py          # CV vs. job description
│   │   ├── review.py           # Standalone CV health check
│   │   ├── tailor.py           # CV rewriting
│   │   └── pdf.py              # PDF text extraction
│   └── tests/                  # 135 pytest tests, no API calls
│
├── frontend/
│   ├── app/                    # Routes: /, /review, /analyse, /applications, /dashboard
│   ├── components/             # One component per file
│   └── lib/api.ts              # Single typed API client — no bare fetch in components
│
└── docker-compose.yml          # Postgres + backend
```

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.11+
- An [Anthropic API key](https://console.anthropic.com)
- Docker (optional — only for the local database)

### 1. Backend

**macOS / Linux:**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then fill in ANTHROPIC_API_KEY
```

**Windows (PowerShell):**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env     # then fill in ANTHROPIC_API_KEY
```

If PowerShell refuses to run the activation script, allow it for the current
session only: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.
Note that PowerShell has no `&&` — run each line separately.

Then start it one of two ways:

**Without a database** — every feature works except saving applications, which is kept
in memory and cleared on restart. Fastest way to try the app:

```bash
uvicorn main_mock:app --reload
```

**With a database** — start Postgres, point `DATABASE_URL` at it, then run the real app.
Tables are created automatically on first boot:

```bash
docker compose up db
uvicorn main:app --reload
```

Either way the API is on `http://localhost:8000`, with interactive docs at `/docs`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local      # Windows: Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

On Windows, `start-dev.bat` in the repo root launches both servers in separate
windows — the quickest way to get everything running at once.

### Environment variables

**`backend/.env`**

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude API key |
| `DATABASE_URL` | for `main.py` | Postgres URI. Supabase users: use the Session pooler connection string, not the `https://` project URL |
| `CORS_ORIGINS` | no | Comma-separated allowed origins. Defaults to `http://localhost:3000` |

**`frontend/.env.local`**

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | no | Backend URL. Defaults to `http://localhost:8000` |

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/analyse/` | Score a CV against a job description |
| `POST` | `/review/` | Standalone CV health review |
| `POST` | `/tailor/` | Rewrite a CV for a specific posting |
| `POST` | `/tailor/general` | Rewrite a CV without a target posting |
| `POST` | `/pdf/extract` | Extract text from an uploaded PDF (max 5 MB) |
| `GET` | `/applications/` | List applications |
| `POST` | `/applications/` | Create an application |
| `GET` | `/applications/{id}` | Get one application |
| `PATCH` | `/applications/{id}` | Update status or notes |
| `DELETE` | `/applications/{id}` | Delete an application |
| `GET` | `/applications/{id}/analyses` | Analysis history for an application |
| `POST` | `/applications/{id}/analyses` | Re-analyse with an updated CV |

Quick check:

```bash
curl http://localhost:8000/health
```

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/
```

135 tests covering endpoint contracts, validation, PDF extraction and tailoring. They
stub the Claude client, so the suite runs offline and costs nothing.

Frontend type-checking and linting:

```bash
cd frontend
npm run build
npm run lint
```

## Deployment

- **Frontend** → Vercel. Set `NEXT_PUBLIC_API_URL` to the deployed backend URL.
- **Backend** → Render, Fly.io or any container host; `backend/Dockerfile` is ready.
  Set `ANTHROPIC_API_KEY`, `DATABASE_URL`, and `CORS_ORIGINS` to your frontend's origin.
- **Database** → a free Supabase project; copy the Session pooler connection string.

## Limitations

Honest list of what this project does *not* do yet:

- **No authentication.** There are no user accounts and no per-user scoping — every
  visitor sees the same applications. Do not deploy it publicly as-is.
- **No rate limiting.** Every analysis costs an API call, so a public deployment would
  let anyone spend your Anthropic credit.
- **AI output is non-deterministic.** Scores can shift slightly between runs on identical
  input; treat them as guidance, not a verdict.
- **PDF extraction is text-only.** Scanned or image-based CVs have no text layer to read,
  and the app asks you to paste the text instead.

## Development notes

This project was built with [Claude Code](https://claude.com/claude-code) using a
structured multi-agent workflow — explore, plan, implement, review, test — defined in
`CLAUDE.md` and `.claude/agents/`. The planning documents and review reports for each
feature are kept in `docs/agent-runs/` (in Polish).

## License

MIT — see [LICENSE](LICENSE).
