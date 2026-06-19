from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ApplicationStatus(str, Enum):
    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"


# --- Request / Response models ---

class AnalyseRequest(BaseModel):
    cv: str
    job_description: str


class AnalyseResponse(BaseModel):
    match_score: int                  # 0-100
    matched_keywords: List[str]
    missing_keywords: List[str]
    suggestions: List[str]            # 3 concrete CV improvements
    summary: str                      # 2-sentence plain-English summary


class PdfExtractResponse(BaseModel):
    text: str


class TailorRequest(BaseModel):
    cv: str
    job_description: str
    missing_keywords: list[str] = []
    suggestions: list[str] = []


class TailorResponse(BaseModel):
    tailored_cv: str


class ApplicationCreate(BaseModel):
    company: str
    role: str
    job_description: Optional[str] = None
    match_score: Optional[int] = None
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None


class ApplicationOut(BaseModel):
    id: str
    user_id: str
    company: str
    role: str
    status: ApplicationStatus
    match_score: Optional[int]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
