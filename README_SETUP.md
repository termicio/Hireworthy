# Setup Steps

## 1. Install tools
- Node.js 18+ → https://nodejs.org
- Python 3.11+ → https://python.org
- Docker Desktop → https://docker.com/products/docker-desktop
- Claude Code → npm install -g @anthropic/claude-code

## 2. Get API keys
- Anthropic → https://console.anthropic.com → API Keys
- Clerk → https://clerk.com → Create application → API Keys

## 3. Create .env files

### backend/.env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://jobtracker:jobtracker@localhost:5432/jobtracker
CLERK_SECRET_KEY=sk_test_...

### frontend/.env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8000

## 4. Start database
docker-compose up db

## 5. Start backend
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload

## 6. Start frontend
cd frontend
npm install
npm run dev
