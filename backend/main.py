from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import applications, analyse, pdf, tailor, review
from config import cors_origins
from database import create_pool, close_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_pool()
    yield
    await close_pool()


app = FastAPI(title="Job Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(analyse.router, prefix="/analyse", tags=["analyse"])
app.include_router(pdf.router, prefix="/pdf", tags=["pdf"])
app.include_router(tailor.router, prefix="/tailor", tags=["tailor"])
app.include_router(review.router, prefix="/review", tags=["review"])

@app.get("/health")
def health():
    return {"status": "ok"}
