@echo off
rem Uruchamia backend (FastAPI + Supabase, port 8000) i frontend (Next.js, port 3000)
rem w dwoch osobnych oknach. Zamkniecie okna zatrzymuje dany serwer.
rem UWAGA: backend musi startowac z katalogu backend\ - load_dotenv() szuka .env w CWD.

set ROOT=%~dp0

start "HIREWORTHY backend :8000" cmd /k "cd /d %ROOT%backend && venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"
start "HIREWORTHY frontend :3000" cmd /k "cd /d %ROOT%frontend && "C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next dev"

echo Backend:  http://localhost:8000  (dokumentacja API: http://localhost:8000/docs)
echo Frontend: http://localhost:3000
timeout /t 5 >nul
