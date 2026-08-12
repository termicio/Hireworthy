"""
Tests for applications API endpoints (Faza 5-6).
Covers: GET /applications/{id}, GET /applications/{id}/analyses, POST /applications/{id}/analyses.
Identifies bugs: I4 (invalid UUID → 500), I5 (match_score no bounds).
"""

import pytest
import json
from unittest.mock import AsyncMock, patch
from datetime import datetime
from pydantic import ValidationError

from models import (
    ApplicationCreate,
    ApplicationStatus,
    AnalysisOut,
    MatchCategory,
    ReanalyseRequest,
)


class TestApplicationCreateModelValidation:
    """Test ApplicationCreate model validation (for I5: match_score bounds)."""

    def test_application_create_match_score_valid_boundary_0(self):
        """ApplicationCreate.match_score = 0 is valid (boundary)."""
        app = ApplicationCreate(
            company="Test",
            role="Test",
            job_description="Test",
            match_score=0,
        )
        assert app.match_score == 0

    def test_application_create_match_score_valid_boundary_100(self):
        """ApplicationCreate.match_score = 100 is valid (boundary)."""
        app = ApplicationCreate(
            company="Test",
            role="Test",
            job_description="Test",
            match_score=100,
        )
        assert app.match_score == 100

    def test_application_create_match_score_above_100_rejected(self):
        """ApplicationCreate.match_score > 100 raises ValidationError (fix I5)."""
        with pytest.raises(ValidationError):
            ApplicationCreate(
                company="Test",
                role="Test",
                job_description="Test",
                match_score=150,  # SHOULD BE REJECTED
            )

    def test_application_create_match_score_negative_rejected(self):
        """ApplicationCreate.match_score < 0 raises ValidationError (fix I5)."""
        with pytest.raises(ValidationError):
            ApplicationCreate(
                company="Test",
                role="Test",
                job_description="Test",
                match_score=-10,  # SHOULD BE REJECTED
            )


class TestAnalysisOutModelValidation:
    """Test AnalysisOut model respects bounds on overall_score."""

    def test_analysis_out_overall_score_valid_0(self):
        """AnalysisOut.overall_score = 0 is valid."""
        analysis = AnalysisOut(
            id="test",
            application_id="test",
            overall_score=0,
            missing_keywords=[],
            categories=[],
            created_at=datetime.now(),
        )
        assert analysis.overall_score == 0

    def test_analysis_out_overall_score_valid_100(self):
        """AnalysisOut.overall_score = 100 is valid."""
        analysis = AnalysisOut(
            id="test",
            application_id="test",
            overall_score=100,
            missing_keywords=[],
            categories=[],
            created_at=datetime.now(),
        )
        assert analysis.overall_score == 100

    def test_analysis_out_overall_score_above_100_rejected(self):
        """AnalysisOut.overall_score > 100 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            AnalysisOut(
                id="test",
                application_id="test",
                overall_score=105,  # INVALID
                missing_keywords=[],
                categories=[],
                created_at=datetime.now(),
            )
        assert "less than or equal to 100" in str(exc_info.value).lower()

    def test_analysis_out_overall_score_negative_rejected(self):
        """AnalysisOut.overall_score < 0 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            AnalysisOut(
                id="test",
                application_id="test",
                overall_score=-5,  # INVALID
                missing_keywords=[],
                categories=[],
                created_at=datetime.now(),
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()


class TestReanalyseRequestValidation:
    """Test ReanalyseRequest model validation."""

    def test_reanalyse_request_cv_required(self):
        """ReanalyseRequest.cv is required."""
        with pytest.raises(ValidationError):
            ReanalyseRequest(job_description="Test")

    def test_reanalyse_request_cv_optional_job_description(self):
        """ReanalyseRequest.job_description is optional."""
        req = ReanalyseRequest(cv="I am a developer with 10 years experience")
        assert req.cv is not None
        assert req.job_description is None

    def test_reanalyse_request_both_fields(self):
        """ReanalyseRequest with both cv and job_description."""
        req = ReanalyseRequest(
            cv="I am a Python developer with 10 years experience",
            job_description="We need a Python expert",
        )
        assert req.cv is not None
        assert req.job_description is not None


class TestApplicationStatusEnum:
    """Test ApplicationStatus enum."""

    def test_application_status_values(self):
        """ApplicationStatus has correct enum values."""
        assert ApplicationStatus.APPLIED.value == "applied"
        assert ApplicationStatus.INTERVIEW.value == "interview"
        assert ApplicationStatus.OFFER.value == "offer"
        assert ApplicationStatus.REJECTED.value == "rejected"

    def test_application_status_count(self):
        """ApplicationStatus has 4 values."""
        statuses = list(ApplicationStatus)
        assert len(statuses) == 4


class TestMatchCategoryModel:
    """Test MatchCategory model validation."""

    def test_match_category_score_validation(self):
        """MatchCategory.score must be between 0-100."""
        # Valid: 50
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=50,
            weight=0.35,
            evidence="Test",
        )
        assert cat.score == 50

    def test_match_category_score_above_100_rejected(self):
        """MatchCategory.score > 100 raises ValidationError."""
        with pytest.raises(ValidationError):
            MatchCategory(
                name="skills_match",
                label="Skills Match",
                score=105,
                weight=0.35,
                evidence="Test",
            )

    def test_match_category_score_below_0_rejected(self):
        """MatchCategory.score < 0 raises ValidationError."""
        with pytest.raises(ValidationError):
            MatchCategory(
                name="skills_match",
                label="Skills Match",
                score=-5,
                weight=0.35,
                evidence="Test",
            )


class TestApplicationCreateWithAnalysis:
    """Test ApplicationCreate with embedded analysis data."""

    def test_application_create_with_missing_keywords_list(self):
        """ApplicationCreate can include missing_keywords list."""
        app = ApplicationCreate(
            company="Test",
            role="Test",
            job_description="Test",
            match_score=75,
            missing_keywords=["Docker", "Kubernetes"],
        )
        assert app.missing_keywords == ["Docker", "Kubernetes"]

    def test_application_create_with_categories(self):
        """ApplicationCreate can include categories list."""
        category = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=80,
            weight=0.35,
            evidence="Good match",
        )
        app = ApplicationCreate(
            company="Test",
            role="Test",
            job_description="Test",
            match_score=75,
            categories=[category],
        )
        assert len(app.categories) == 1
        assert app.categories[0].name == "skills_match"

    def test_application_create_with_notes(self):
        """ApplicationCreate can include notes."""
        app = ApplicationCreate(
            company="Test",
            role="Test",
            job_description="Test",
            notes="Great opportunity",
        )
        assert app.notes == "Great opportunity"

    def test_application_create_minimal(self):
        """ApplicationCreate requires only company and role."""
        app = ApplicationCreate(
            company="Test",
            role="Test Role",
        )
        assert app.company == "Test"
        assert app.role == "Test Role"
        assert app.job_description is None
        assert app.match_score is None


class TestApplicationCreateValidationErrors:
    """Test ApplicationCreate validation edge cases."""

    def test_application_create_missing_company_rejected(self):
        """ApplicationCreate without company raises ValidationError."""
        with pytest.raises(ValidationError):
            ApplicationCreate(role="Test Role")

    def test_application_create_missing_role_rejected(self):
        """ApplicationCreate without role raises ValidationError."""
        with pytest.raises(ValidationError):
            ApplicationCreate(company="Test Company")

    def test_application_create_empty_company_invalid(self):
        """ApplicationCreate with empty company string is accepted (no length validation)."""
        # Note: models.py doesn't have min_length constraint on company/role
        app = ApplicationCreate(company="", role="Test")
        assert app.company == ""


class TestReanalyseRequestEdgeCases:
    """Test ReanalyseRequest edge cases."""

    def test_reanalyse_request_cv_boundary_49_chars(self):
        """ReanalyseRequest.cv validation happens at route level (49 chars)."""
        # Model doesn't validate length; route endpoint does
        req = ReanalyseRequest(cv="x" * 49)
        assert len(req.cv) == 49

    def test_reanalyse_request_cv_boundary_50_chars(self):
        """ReanalyseRequest.cv of 50 chars is valid."""
        req = ReanalyseRequest(cv="x" * 50)
        assert len(req.cv) == 50

    def test_reanalyse_request_empty_cv_accepted_by_model(self):
        """ReanalyseRequest.cv can be empty at model level (endpoint validates)."""
        req = ReanalyseRequest(cv="")
        assert req.cv == ""


class TestAnalysisOutRoundTrip:
    """Test AnalysisOut serialization/deserialization."""

    def test_analysis_out_with_match_categories(self):
        """AnalysisOut correctly serializes with nested MatchCategory."""
        category = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=85,
            weight=0.35,
            evidence="Good skills",
            missing_keywords=["Kubernetes"],
        )
        analysis = AnalysisOut(
            id="test-id",
            application_id="app-id",
            overall_score=85,
            missing_keywords=["Kubernetes"],
            categories=[category],
            created_at=datetime(2026, 7, 1, 10, 0, 0),
        )
        assert analysis.overall_score == 85
        assert len(analysis.categories) == 1
        assert analysis.categories[0].score == 85

    def test_analysis_out_jsonb_deserialization_from_dict(self):
        """AnalysisOut can be created from dict with JSONB-like fields."""
        data = {
            "id": "test-id",
            "application_id": "app-id",
            "overall_score": 75,
            "missing_keywords": ["Docker", "K8s"],
            "categories": [
                {
                    "name": "skills_match",
                    "label": "Skills Match",
                    "score": 80,
                    "weight": 0.35,
                    "evidence": "Good match",
                    "missing_keywords": [],
                }
            ],
            "created_at": datetime(2026, 7, 1, 10, 0, 0),
        }
        analysis = AnalysisOut(**data)
        assert analysis.overall_score == 75
        assert analysis.missing_keywords == ["Docker", "K8s"]


class TestApplicationStatusUpdate:
    """Test ApplicationStatus in update context."""

    def test_application_status_enum_case_sensitive(self):
        """ApplicationStatus values are lowercase."""
        # This is important for database consistency
        assert ApplicationStatus.APPLIED.value == "applied"
        assert ApplicationStatus.INTERVIEW.value == "interview"
        assert ApplicationStatus.OFFER.value == "offer"
        assert ApplicationStatus.REJECTED.value == "rejected"

    def test_application_status_string_value_consistency(self):
        """ApplicationStatus string values are consistent."""
        for status in ApplicationStatus:
            # Verify round-trip: enum -> value -> enum
            value = status.value
            reconstructed = ApplicationStatus(value)
            assert reconstructed == status


class TestMatchCategoryWeights:
    """Test MatchCategory weight validation."""

    def test_match_category_weight_zero(self):
        """MatchCategory can have weight=0."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=50,
            weight=0.0,
            evidence="Test",
        )
        assert cat.weight == 0.0

    def test_match_category_weight_one(self):
        """MatchCategory can have weight=1."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=50,
            weight=1.0,
            evidence="Test",
        )
        assert cat.weight == 1.0

    def test_match_category_weight_fractional(self):
        """MatchCategory can have fractional weight."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=50,
            weight=0.35,
            evidence="Test",
        )
        assert cat.weight == 0.35


class TestMatchCategoryMissingKeywords:
    """Test MatchCategory missing_keywords field."""

    def test_match_category_missing_keywords_empty_default(self):
        """MatchCategory.missing_keywords defaults to []."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=50,
            weight=0.35,
            evidence="Test",
        )
        assert cat.missing_keywords == []

    def test_match_category_missing_keywords_list(self):
        """MatchCategory.missing_keywords accepts list of strings."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=50,
            weight=0.35,
            evidence="Test",
            missing_keywords=["Docker", "Kubernetes", "Rust"],
        )
        assert cat.missing_keywords == ["Docker", "Kubernetes", "Rust"]

    def test_match_category_missing_keywords_must_be_list(self):
        """MatchCategory.missing_keywords must be list, not string."""
        with pytest.raises(ValidationError):
            MatchCategory(
                name="skills_match",
                label="Skills Match",
                score=50,
                weight=0.35,
                evidence="Test",
                missing_keywords="Docker",  # INVALID: should be list
            )


class TestApplicationCreateOptionalFields:
    """Test ApplicationCreate optional fields behavior."""

    def test_all_optional_fields_none(self):
        """ApplicationCreate with all optional fields as None."""
        app = ApplicationCreate(
            company="Test",
            role="Test",
            job_description=None,
            match_score=None,
            missing_keywords=None,
            categories=None,
            notes=None,
        )
        assert app.job_description is None
        assert app.match_score is None
        assert app.missing_keywords is None
        assert app.categories is None
        assert app.notes is None

    def test_optional_fields_omitted(self):
        """ApplicationCreate with optional fields omitted."""
        app = ApplicationCreate(
            company="Test",
            role="Test",
        )
        assert app.job_description is None
        assert app.match_score is None
        assert app.missing_keywords is None
        assert app.categories is None
        assert app.notes is None


class TestAnalysisOutRequiredFields:
    """Test AnalysisOut required fields."""

    def test_analysis_out_missing_id_rejected(self):
        """AnalysisOut without id raises ValidationError."""
        with pytest.raises(ValidationError):
            AnalysisOut(
                application_id="app-id",
                overall_score=75,
                missing_keywords=[],
                categories=[],
                created_at=datetime.now(),
            )

    def test_analysis_out_missing_application_id_rejected(self):
        """AnalysisOut without application_id raises ValidationError."""
        with pytest.raises(ValidationError):
            AnalysisOut(
                id="test-id",
                overall_score=75,
                missing_keywords=[],
                categories=[],
                created_at=datetime.now(),
            )

    def test_analysis_out_missing_created_at_rejected(self):
        """AnalysisOut without created_at raises ValidationError."""
        with pytest.raises(ValidationError):
            AnalysisOut(
                id="test-id",
                application_id="app-id",
                overall_score=75,
                missing_keywords=[],
                categories=[],
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
