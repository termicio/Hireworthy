from pydantic import BaseModel, Field
from typing import Optional, List, Literal
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


import re as _re

class PDFGenerateRequest(BaseModel):
    cv_text: str
    layout: Literal["classic", "modern", "split"]
    color: Optional[str] = None

    @property
    def safe_color(self) -> Optional[str]:
        """Return color only if it is a valid CSS hex color (#RGB or #RRGGBB)."""
        if self.color and _re.fullmatch(r"#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?", self.color):
            return self.color
        return None
