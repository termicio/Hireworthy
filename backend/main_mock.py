"""Dev entrypoint that mirrors main.py but with an in-memory applications
store instead of Postgres. analyse/pdf/tailor/review routers are the real,
unmodified ones — only persistence is mocked.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import analyse, pdf, tailor, review
from config import cors_origins
import mock_applications

app = FastAPI(title="Job Tracker API (mock DB)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mock_applications.router, prefix="/applications", tags=["applications"])
app.include_router(analyse.router, prefix="/analyse", tags=["analyse"])
app.include_router(pdf.router, prefix="/pdf", tags=["pdf"])
app.include_router(tailor.router, prefix="/tailor", tags=["tailor"])
app.include_router(review.router, prefix="/review", tags=["review"])


@app.get("/health")
def health():
    return {"status": "ok (mock db)"}
