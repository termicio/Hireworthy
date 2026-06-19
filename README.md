# 🎯 Job Application Tracker — AI-Powered

A full-stack web app that uses AI to analyse how well your CV matches a job description, tracks your applications, and helps you improve your chances.

## Features

- 📊 **AI Match Analysis** — paste a CV + job description, get a match score, missing keywords, and tailored suggestions
- 📋 **Application Tracker** — track status across Applied → Interview → Offer → Rejected
- 📈 **Dashboard** — charts showing your activity, average match score, pipeline stats
- 🔐 **Auth** — per-user data with Clerk

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL via Supabase |
| AI | Anthropic Claude API |
| Auth | Clerk |
| Deploy | Vercel (frontend) + Render (backend) |

## Project Structure

```
job-tracker/
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── dashboard/         # Stats & charts
│   │   ├── applications/      # CRUD list view
│   │   └── analyse/           # CV analyser tool
│   ├── components/
│   └── lib/
│       └── api.ts             # API client
│
├── backend/                   # FastAPI
│   ├── main.py
│   ├── routes/
│   │   ├── applications.py    # CRUD endpoints
│   │   └── analyse.py         # AI analysis endpoint
│   ├── models.py              # Pydantic + DB models
│   ├── database.py            # DB connection
│   └── ai.py                  # Claude API logic
│
└── docker-compose.yml         # Local dev (postgres + backend)
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker (for local postgres)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

### Environment Variables

**Backend `.env`**
```
ANTHROPIC_API_KEY=your_key
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=your_key
```

**Frontend `.env.local`**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/analyse` | Analyse CV vs job description |
| GET | `/applications` | List user's applications |
| POST | `/applications` | Create new application |
| PATCH | `/applications/{id}` | Update status |
| DELETE | `/applications/{id}` | Delete application |

## Deployment

- Frontend → push to GitHub, connect to Vercel (auto-deploy)
- Backend → connect repo to Render, set env vars
- Database → create free Supabase project, copy connection string
