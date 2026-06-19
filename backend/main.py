from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import applications, analyse

app = FastAPI(title="Job Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(analyse.router, prefix="/analyse", tags=["analyse"])

@app.get("/health")
def health():
    return {"status": "ok"}
