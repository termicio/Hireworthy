from pydantic import BaseModel, Field
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


class MatchCategory(BaseModel):
    name: str
    label: str
    score: float = Field(ge=0, le=100)
    weight: float
    evidence: str
    missing_keywords: List[str] = []


class HealthCategory(BaseModel):
    name: str
    label: str
    score: float = Field(ge=0, le=100)
    weight: float
    evidence: str
    tips: List[str]


class AnalyseResponse(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    categories: List[MatchCategory]
    matched_keywords: List[str] = []
    explanation: str
    missing_keywords: List[str]
    suggestions: List[str]


class PdfExtractResponse(BaseModel):
    text: str


class TailorRequest(BaseModel):
    cv: str
    job_description: str
    missing_keywords: list[str] = []
    suggestions: list[str] = []


class TailorGeneralRequest(BaseModel):
    cv: str


class TailorResponse(BaseModel):
    tailored_cv: str


class ApplicationCreate(BaseModel):
    company: str
    role: str
    job_description: Optional[str] = None
    match_score: Optional[int] = Field(default=None, ge=0, le=100)
    missing_keywords: Optional[List[str]] = None
    categories: Optional[List[MatchCategory]] = None
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
    job_description: Optional[str] = None
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class ReanalyseRequest(BaseModel):
    cv: str
    job_description: Optional[str] = None


class AnalysisOut(BaseModel):
    id: str
    application_id: str
    overall_score: int = Field(ge=0, le=100)
    missing_keywords: List[str]
    categories: List[MatchCategory]
    created_at: datetime


class WeakBullet(BaseModel):
    original: str
    reason: str
    rewritten: str


class ReviewRequest(BaseModel):
    cv: str


class CVHealthResponse(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    categories: List[HealthCategory]
    weak_bullets: List[WeakBullet]
    red_flags: List[str]
    quick_wins: List[str]

class ReviewResponse(CVHealthResponse):
    pass
