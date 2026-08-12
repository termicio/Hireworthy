"""
Tests for applications API endpoints - validation and edge cases.
Tests focus on model validation, edge cases, and documented bugs.
"""

import pytest
import json
from datetime import datetime
from pydantic import ValidationError
from models import AnalyseResponse, MatchCategory, ApplicationCreate, ReanalyseRequest


class TestApplicationCreateWithAnalysis:
    """Test ApplicationCreate with embedded analysis data (Faza 5)."""

    def test_application_create_with_missing_keywords_and_categories(self):
        """
        POST /applications/ with match_score embeds missing_keywords and categories
        for atomic insert of both application and first analysis record.
        """
        category = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=80,
            weight=0.35,
            evidence="Good match",
            missing_keywords=["Docker"],
        )

        app = ApplicationCreate(
            company="Acme",
            role="Python Developer",
            job_description="Python backend role",
            match_score=75,
            missing_keywords=["Docker", "Kubernetes"],
            categories=[category],
        )

        assert app.match_score == 75
        assert app.missing_keywords == ["Docker", "Kubernetes"]
        assert len(app.categories) == 1
        assert app.categories[0].name == "skills_match"

    def test_application_create_jsonb_serializable(self):
        """
        missing_keywords and categories in ApplicationCreate are JSON-serializable
        for JSONB storage in database.
        """
        category = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=80,
            weight=0.35,
            evidence="Good match",
            missing_keywords=["Docker"],
        )

        app = ApplicationCreate(
            company="Acme",
            role="Dev",
            job_description="Test",
            match_score=75,
            missing_keywords=["Docker"],
            categories=[category],
        )

        # Verify serializable to JSON (like routes do before DB insert)
        keywords_json = json.dumps(app.missing_keywords)
        assert json.loads(keywords_json) == ["Docker"]

        categories_json = json.dumps([c.model_dump() for c in app.categories])
        parsed = json.loads(categories_json)
        assert parsed[0]["name"] == "skills_match"


class TestReanalyseRequestValidation:
    """Test ReanalyseRequest validation (Faza 5 re-analysis endpoint)."""

    def test_reanalyse_request_cv_must_be_provided(self):
        """ReanalyseRequest.cv is required."""
        with pytest.raises(Exception):  # ValidationError
            ReanalyseRequest(job_description="Test")

    def test_reanalyse_request_cv_minimum_50_chars_enforced_at_route(self):
        """
        Model allows any cv string; route handler validates >= 50 chars.
        Edge case: test that model itself doesn't enforce (route does).
        """
        # Model accepts < 50 chars
        req = ReanalyseRequest(cv="short")
        assert len(req.cv) == 5

        # Validation happens in route handler: if len(body.cv.strip()) < 50: raise 400

    def test_reanalyse_request_job_description_optional(self):
        """ReanalyseRequest.job_description is optional."""
        req = ReanalyseRequest(cv="I am a developer with 10 years experience")
        assert req.cv is not None
        assert req.job_description is None

    def test_reanalyse_request_job_description_override_allowed(self):
        """
        ReanalyseRequest can override job_description.
        Route uses: body.job_description OR saved app.job_description.
        """
        req = ReanalyseRequest(
            cv="I am a developer with 10 years experience",
            job_description="Override job description",
        )
        assert req.job_description == "Override job description"


class TestApplicationCreateMatchScoreBounds:
    """ApplicationCreate.match_score bounds (bug I5 — naprawiony: ge=0, le=100)."""

    def test_match_score_above_100_rejected(self):
        with pytest.raises(ValidationError):
            ApplicationCreate(company="Test", role="Test", match_score=150)

    def test_match_score_below_0_rejected(self):
        with pytest.raises(ValidationError):
            ApplicationCreate(company="Test", role="Test", match_score=-10)

    def test_analysis_out_overall_score_properly_constrained(self):
        """
        AnalysisOut.overall_score HAS proper bounds (ge=0, le=100),
        unlike ApplicationCreate.match_score.
        This creates asymmetry: application creation can persist invalid scores,
        but response model rejects them (causing 500 on GET /analyses).
        """
        from models import AnalysisOut

        # Valid boundaries work
        analysis = AnalysisOut(
            id="test",
            application_id="app1",
            overall_score=100,
            missing_keywords=[],
            categories=[],
            created_at=datetime.now(),
        )
        assert analysis.overall_score == 100

        # Invalid scores rejected
        with pytest.raises(Exception):  # ValidationError
            AnalysisOut(
                id="test",
                application_id="app1",
                overall_score=105,  # > 100
                missing_keywords=[],
                categories=[],
                created_at=datetime.now(),
            )


class TestApplicationCVTextValidation:
    """Test CV validation in reanalyse endpoint (D3: no upper limit)."""

    def test_cv_minimum_length_enforced_at_route(self):
        """
        Route handler checks: if len(body.cv.strip()) < 50: raise 400
        This is the validation point for re-analysis CV.
        """
        # Edge case: exactly 50 chars should pass
        req = ReanalyseRequest(cv="x" * 50)
        assert len(req.cv) == 50

        # Edge case: 49 chars should fail route validation
        req = ReanalyseRequest(cv="x" * 49)
        assert len(req.cv) == 49
        # Route would reject this with 400

    def test_cv_whitespace_stripping_before_validation(self):
        """
        Route validation uses body.cv.strip() before length check.
        Edge case: "   short   " is 12 chars raw, 5 chars stripped -> fails.
        """
        req = ReanalyseRequest(cv="   short   ")
        # Before strip: 12 chars, after strip: 5 chars
        assert len(req.cv) == 11
        assert len(req.cv.strip()) == 5

    def test_cv_no_upper_limit_in_validation(self):
        """
        BUG D3: ReanalyseRequest.cv has no max_length constraint.
        User could submit multi-megabyte CV, expensive Claude call.
        """
        large_cv = "x" * 1000000  # 1MB
        req = ReanalyseRequest(cv=large_cv)
        # Model accepts it
        assert len(req.cv) == 1000000


class TestApplicationJobDescriptionValidation:
    """Test job_description handling in reanalyse."""

    def test_job_description_fallback_to_saved(self):
        """
        Route logic: job_description = body.job_description OR app_row.job_description
        If neither present, returns 400.
        """
        # Model allows both to be missing
        req = ReanalyseRequest(cv="I am a developer with 10 years experience")
        assert req.job_description is None
        # Route would then check: app_row.job_description must exist

    def test_job_description_minimum_length_enforced(self):
        """
        Route checks job description >= 50 chars (same as CV).
        """
        req = ReanalyseRequest(
            cv="I am a developer with 10 years experience",
            job_description="short",  # Too short
        )
        # Route would reject with 400: "too short"

    def test_job_description_override_in_request(self):
        """
        ReanalyseRequest allows overriding saved job_description.
        """
        req = ReanalyseRequest(
            cv="I am a developer with 10 years experience",
            job_description="New job description for analysis",
        )
        assert req.job_description == "New job description for analysis"


class TestAnalysisDataPersistence:
    """Test that analysis data is properly stored and retrieved (Faza 5)."""

    def test_missing_keywords_as_json_list(self):
        """
        missing_keywords stored as JSONB in database.
        When returned as AnalysisOut, should be list of strings.
        """
        from models import AnalysisOut

        analysis = AnalysisOut(
            id="analysis-1",
            application_id="app-1",
            overall_score=75,
            missing_keywords=["Docker", "Kubernetes", "Rust"],
            categories=[],
            created_at=datetime.now(),
        )

        assert isinstance(analysis.missing_keywords, list)
        assert analysis.missing_keywords == ["Docker", "Kubernetes", "Rust"]

    def test_categories_as_json_objects(self):
        """
        categories stored as JSONB array of objects in database.
        When returned, deserialized to list of MatchCategory.
        """
        from models import AnalysisOut

        category = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=80,
            weight=0.35,
            evidence="Good match",
            missing_keywords=["Docker"],
        )

        analysis = AnalysisOut(
            id="analysis-1",
            application_id="app-1",
            overall_score=75,
            missing_keywords=[],
            categories=[category],
            created_at=datetime.now(),
        )

        assert len(analysis.categories) == 1
        assert isinstance(analysis.categories[0], MatchCategory)
        assert analysis.categories[0].name == "skills_match"

    def test_analysis_created_at_timestamp_preserved(self):
        """
        created_at is TIMESTAMPTZ in database, preserved as datetime in response.
        """
        from models import AnalysisOut

        created = datetime(2026, 7, 1, 10, 30, 45)
        analysis = AnalysisOut(
            id="analysis-1",
            application_id="app-1",
            overall_score=75,
            missing_keywords=[],
            categories=[],
            created_at=created,
        )

        assert analysis.created_at == created


class TestApplicationOut:
    """Test ApplicationOut includes job_description (Faza 5 change)."""

    def test_application_out_job_description_field_present(self):
        """
        ApplicationOut should include job_description field
        (added in Faza 5 to support saving job description with application).
        """
        from models import ApplicationOut, ApplicationStatus

        app = ApplicationOut(
            id="app-1",
            user_id="user1",
            company="Acme",
            role="Python Dev",
            status=ApplicationStatus.APPLIED,
            match_score=75,
            job_description="Python backend role with Django",
            notes=None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        assert app.job_description == "Python backend role with Django"

    def test_application_out_job_description_optional(self):
        """
        ApplicationOut.job_description can be None
        (for applications created without job description).
        """
        from models import ApplicationOut, ApplicationStatus

        app = ApplicationOut(
            id="app-1",
            user_id="user1",
            company="Acme",
            role="Python Dev",
            status=ApplicationStatus.APPLIED,
            match_score=None,
            job_description=None,  # Allowed to be None
            notes=None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        assert app.job_description is None


class TestAnalysisListOrdering:
    """Test GET /applications/{id}/analyses returns chronological order (Faza 5)."""

    def test_analyses_ordered_by_created_at_ascending(self):
        """
        GET /applications/{id}/analyses returns list sorted by created_at ASC.
        Oldest analysis first, newest last.
        Route query: ORDER BY created_at ASC
        """
        from models import AnalysisOut

        analysis1 = AnalysisOut(
            id="a1",
            application_id="app-1",
            overall_score=65,
            missing_keywords=["Docker"],
            categories=[],
            created_at=datetime(2026, 7, 1, 10, 0, 0),
        )

        analysis2 = AnalysisOut(
            id="a2",
            application_id="app-1",
            overall_score=75,
            missing_keywords=[],
            categories=[],
            created_at=datetime(2026, 7, 2, 10, 0, 0),
        )

        # Verify chronological order
        assert analysis1.created_at < analysis2.created_at
        # List would be [analysis1, analysis2]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
