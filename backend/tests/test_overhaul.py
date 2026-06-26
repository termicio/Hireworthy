"""
Comprehensive tests for models.py and ai.py refactoring.
Tests cover:
- Pydantic model validation (scores, types, defaults)
- _enrich() function (correct scoring, error handling, edge cases)
- Category weight sums
- ReviewResponse alias
"""

import pytest
from pydantic import ValidationError
from models import (
    MatchCategory,
    HealthCategory,
    AnalyseResponse,
    CVHealthResponse,
    ReviewResponse,
)
from ai import _enrich, HEALTH_CATEGORIES, MATCH_CATEGORIES


# ============================================================================
# 1. PYDANTIC MODEL VALIDATION TESTS
# ============================================================================


class TestMatchCategory:
    """Test MatchCategory model validation."""

    def test_valid_match_category(self):
        """Happy path: valid MatchCategory with all fields."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=85.5,
            weight=0.35,
            evidence="CV mentions Python",
            missing_keywords=["Kubernetes"],
        )
        assert cat.score == 85.5
        assert cat.missing_keywords == ["Kubernetes"]

    def test_match_category_score_zero(self):
        """Score at lower bound (0) is valid."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=0,
            weight=0.35,
            evidence="No skills match",
            missing_keywords=[],
        )
        assert cat.score == 0

    def test_match_category_score_hundred(self):
        """Score at upper bound (100) is valid."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=100,
            weight=0.35,
            evidence="Perfect match",
            missing_keywords=[],
        )
        assert cat.score == 100

    def test_match_category_score_above_100_rejected(self):
        """Score > 100 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            MatchCategory(
                name="skills_match",
                label="Skills Match",
                score=105,
                weight=0.35,
                evidence="Test",
                missing_keywords=[],
            )
        assert "less than or equal to 100" in str(exc_info.value).lower()

    def test_match_category_score_below_0_rejected(self):
        """Score < 0 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            MatchCategory(
                name="skills_match",
                label="Skills Match",
                score=-5,
                weight=0.35,
                evidence="Test",
                missing_keywords=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_match_category_missing_keywords_default_empty_list(self):
        """missing_keywords defaults to [] when omitted."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=50,
            weight=0.35,
            evidence="Test",
        )
        assert cat.missing_keywords == []
        assert isinstance(cat.missing_keywords, list)

    def test_match_category_missing_keywords_must_be_list(self):
        """missing_keywords must be a list, not string or other type."""
        with pytest.raises(ValidationError):
            MatchCategory(
                name="skills_match",
                label="Skills Match",
                score=50,
                weight=0.35,
                evidence="Test",
                missing_keywords="Docker",  # Should be list
            )


class TestHealthCategory:
    """Test HealthCategory model validation."""

    def test_valid_health_category(self):
        """Happy path: valid HealthCategory with tips."""
        cat = HealthCategory(
            name="clarity",
            label="Clarity",
            score=75,
            weight=0.25,
            evidence="Good formatting",
            tips=["Add consistent date format"],
        )
        assert cat.score == 75
        assert cat.tips == ["Add consistent date format"]
        assert len(cat.tips) > 0

    def test_health_category_score_zero(self):
        """Score at lower bound (0) is valid."""
        cat = HealthCategory(
            name="clarity",
            label="Clarity",
            score=0,
            weight=0.25,
            evidence="Unreadable",
            tips=["Reformat completely"],
        )
        assert cat.score == 0

    def test_health_category_score_hundred(self):
        """Score at upper bound (100) is valid."""
        cat = HealthCategory(
            name="clarity",
            label="Clarity",
            score=100,
            weight=0.25,
            evidence="Perfect clarity",
            tips=[],
        )
        assert cat.score == 100

    def test_health_category_score_above_100_rejected(self):
        """Score > 100 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            HealthCategory(
                name="clarity",
                label="Clarity",
                score=101,
                weight=0.25,
                evidence="Test",
                tips=[],
            )
        assert "less than or equal to 100" in str(exc_info.value).lower()

    def test_health_category_score_below_0_rejected(self):
        """Score < 0 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            HealthCategory(
                name="clarity",
                label="Clarity",
                score=-1,
                weight=0.25,
                evidence="Test",
                tips=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_health_category_tips_required(self):
        """tips field is required (no default)."""
        with pytest.raises(ValidationError):
            HealthCategory(
                name="clarity",
                label="Clarity",
                score=50,
                weight=0.25,
                evidence="Test",
                # Missing tips
            )

    def test_health_category_tips_must_be_list(self):
        """tips must be a list."""
        with pytest.raises(ValidationError):
            HealthCategory(
                name="clarity",
                label="Clarity",
                score=50,
                weight=0.25,
                evidence="Test",
                tips="Add spaces",  # Should be list
            )

    def test_health_category_empty_tips_list_valid(self):
        """Empty tips list is valid."""
        cat = HealthCategory(
            name="clarity",
            label="Clarity",
            score=95,
            weight=0.25,
            evidence="Already excellent",
            tips=[],
        )
        assert cat.tips == []


class TestAnalyseResponse:
    """Test AnalyseResponse model validation."""

    def test_analyse_response_overall_score_zero(self):
        """overall_score at lower bound (0) is valid."""
        resp = AnalyseResponse(
            overall_score=0,
            categories=[],
            matched_keywords=[],
            explanation="No match",
            missing_keywords=[],
            suggestions=[],
        )
        assert resp.overall_score == 0

    def test_analyse_response_overall_score_hundred(self):
        """overall_score at upper bound (100) is valid."""
        resp = AnalyseResponse(
            overall_score=100,
            categories=[],
            matched_keywords=[],
            explanation="Perfect match",
            missing_keywords=[],
            suggestions=[],
        )
        assert resp.overall_score == 100

    def test_analyse_response_overall_score_above_100_rejected(self):
        """overall_score > 100 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            AnalyseResponse(
                overall_score=105,
                categories=[],
                matched_keywords=[],
                explanation="Test",
                missing_keywords=[],
                suggestions=[],
            )
        assert "less than or equal to 100" in str(exc_info.value).lower()

    def test_analyse_response_overall_score_below_0_rejected(self):
        """overall_score < 0 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            AnalyseResponse(
                overall_score=-1,
                categories=[],
                matched_keywords=[],
                explanation="Test",
                missing_keywords=[],
                suggestions=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_analyse_response_with_categories(self):
        """AnalyseResponse accepts valid MatchCategory list."""
        cat = MatchCategory(
            name="skills_match",
            label="Skills Match",
            score=80,
            weight=0.35,
            evidence="Good match",
            missing_keywords=[],
        )
        resp = AnalyseResponse(
            overall_score=80,
            categories=[cat],
            matched_keywords=["Python", "PostgreSQL"],
            explanation="Good fit",
            missing_keywords=["Kubernetes"],
            suggestions=["Add Kubernetes"],
        )
        assert len(resp.categories) == 1
        assert resp.categories[0].name == "skills_match"

    def test_analyse_response_matched_keywords_default_empty(self):
        """matched_keywords defaults to [] when omitted."""
        resp = AnalyseResponse(
            overall_score=50,
            categories=[],
            explanation="Test",
            missing_keywords=[],
            suggestions=[],
        )
        assert resp.matched_keywords == []


class TestCVHealthResponse:
    """Test CVHealthResponse model validation."""

    def test_cv_health_response_overall_score_zero(self):
        """overall_score at lower bound (0) is valid."""
        resp = CVHealthResponse(
            overall_score=0,
            categories=[],
            weak_bullets=[],
            red_flags=[],
            quick_wins=[],
        )
        assert resp.overall_score == 0

    def test_cv_health_response_overall_score_hundred(self):
        """overall_score at upper bound (100) is valid."""
        resp = CVHealthResponse(
            overall_score=100,
            categories=[],
            weak_bullets=[],
            red_flags=[],
            quick_wins=[],
        )
        assert resp.overall_score == 100

    def test_cv_health_response_overall_score_above_100_rejected(self):
        """overall_score > 100 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            CVHealthResponse(
                overall_score=110,
                categories=[],
                weak_bullets=[],
                red_flags=[],
                quick_wins=[],
            )
        assert "less than or equal to 100" in str(exc_info.value).lower()

    def test_cv_health_response_overall_score_below_0_rejected(self):
        """overall_score < 0 raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            CVHealthResponse(
                overall_score=-10,
                categories=[],
                weak_bullets=[],
                red_flags=[],
                quick_wins=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()


class TestReviewResponseAlias:
    """Test that ReviewResponse is an alias for CVHealthResponse."""

    def test_review_response_is_subclass_of_cv_health_response(self):
        """ReviewResponse should be a subclass of CVHealthResponse (not an alias)."""
        assert issubclass(ReviewResponse, CVHealthResponse)

    def test_review_response_same_behavior(self):
        """ReviewResponse behaves identically to CVHealthResponse."""
        resp = ReviewResponse(
            overall_score=75,
            categories=[],
            weak_bullets=[],
            red_flags=["No GPA"],
            quick_wins=["Add metrics"],
        )
        assert isinstance(resp, CVHealthResponse)
        assert resp.overall_score == 75
        assert resp.red_flags == ["No GPA"]


# ============================================================================
# 2. CATEGORY WEIGHTS TESTS
# ============================================================================


class TestCategoryWeights:
    """Test that category weight constants sum to 1.0."""

    def test_health_categories_weights_sum_to_one(self):
        """HEALTH_CATEGORIES weights must sum to 1.0."""
        total = sum(cat["weight"] for cat in HEALTH_CATEGORIES.values())
        assert abs(total - 1.0) < 1e-9, f"Health weights sum: {total}, expected 1.0"

    def test_health_categories_has_four_keys(self):
        """HEALTH_CATEGORIES must have exactly 4 keys."""
        expected_keys = {"clarity", "completeness", "impact_language", "ats_friendliness"}
        assert set(HEALTH_CATEGORIES.keys()) == expected_keys

    def test_match_categories_weights_sum_to_one(self):
        """MATCH_CATEGORIES weights must sum to 1.0."""
        total = sum(cat["weight"] for cat in MATCH_CATEGORIES.values())
        assert abs(total - 1.0) < 1e-9, f"Match weights sum: {total}, expected 1.0"

    def test_match_categories_has_four_keys(self):
        """MATCH_CATEGORIES must have exactly 4 keys."""
        expected_keys = {
            "skills_match",
            "experience_relevance",
            "seniority_fit",
            "education_fit",
        }
        assert set(MATCH_CATEGORIES.keys()) == expected_keys

    def test_health_categories_all_have_label_and_weight(self):
        """Each HEALTH_CATEGORIES entry must have 'label' and 'weight'."""
        for name, meta in HEALTH_CATEGORIES.items():
            assert "label" in meta, f"Category {name} missing 'label'"
            assert "weight" in meta, f"Category {name} missing 'weight'"
            assert isinstance(meta["weight"], (int, float)), f"Weight for {name} not numeric"

    def test_match_categories_all_have_label_and_weight(self):
        """Each MATCH_CATEGORIES entry must have 'label' and 'weight'."""
        for name, meta in MATCH_CATEGORIES.items():
            assert "label" in meta, f"Category {name} missing 'label'"
            assert "weight" in meta, f"Category {name} missing 'weight'"
            assert isinstance(meta["weight"], (int, float)), f"Weight for {name} not numeric"


# ============================================================================
# 3. _ENRICH FUNCTION TESTS
# ============================================================================


class TestEnrichFunction:
    """Test _enrich() function behavior."""

    def test_enrich_valid_categories_with_match_weights(self):
        """Happy path: _enrich adds labels/weights to MatchCategory data."""
        categories = [
            {
                "name": "skills_match",
                "score": 80,
                "evidence": "Good match",
                "missing_keywords": [],
            },
            {
                "name": "experience_relevance",
                "score": 70,
                "evidence": "Some relevance",
                "missing_keywords": [],
            },
        ]
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        assert len(enriched) == 2
        assert enriched[0]["label"] == "Skills Match"
        assert enriched[0]["weight"] == 0.35
        assert enriched[1]["label"] == "Experience Relevance"
        assert enriched[1]["weight"] == 0.30
        # overall_score = round(80 * 0.35 + 70 * 0.30) = round(28 + 21) = 49
        assert overall == 49

    def test_enrich_valid_categories_with_health_weights(self):
        """_enrich works with HEALTH_CATEGORIES."""
        categories = [
            {
                "name": "clarity",
                "score": 90,
                "evidence": "Clear format",
                "tips": [],
            },
            {
                "name": "completeness",
                "score": 80,
                "evidence": "All sections present",
                "tips": [],
            },
            {
                "name": "impact_language",
                "score": 75,
                "evidence": "Some metrics",
                "tips": [],
            },
            {
                "name": "ats_friendliness",
                "score": 85,
                "evidence": "Single column",
                "tips": [],
            },
        ]
        enriched, overall = _enrich(categories, HEALTH_CATEGORIES)

        assert len(enriched) == 4
        assert enriched[0]["label"] == "Clarity"
        assert enriched[0]["weight"] == 0.25
        # overall = round(90*0.25 + 80*0.25 + 75*0.30 + 85*0.20)
        #         = round(22.5 + 20 + 22.5 + 17) = round(82) = 82
        assert overall == 82

    def test_enrich_unknown_category_raises_value_error(self):
        """Unknown category name raises ValueError."""
        categories = [
            {
                "name": "unknown_category",
                "score": 50,
                "evidence": "Test",
                "missing_keywords": [],
            },
        ]
        with pytest.raises(ValueError) as exc_info:
            _enrich(categories, MATCH_CATEGORIES)
        assert "unexpected category name" in str(exc_info.value).lower()
        assert "unknown_category" in str(exc_info.value)

    def test_enrich_empty_categories_list(self):
        """Empty categories list returns overall_score=0."""
        categories = []
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        assert enriched == []
        assert overall == 0

    def test_enrich_single_category_score_calculation(self):
        """Single category: overall = round(score * weight)."""
        categories = [
            {
                "name": "skills_match",
                "score": 100,
                "evidence": "Perfect",
                "missing_keywords": [],
            },
        ]
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        # overall = round(100 * 0.35) = round(35) = 35
        assert overall == 35

    def test_enrich_all_four_match_categories(self):
        """_enrich with all 4 MATCH_CATEGORIES."""
        categories = [
            {
                "name": "skills_match",
                "score": 100,
                "evidence": "Test",
                "missing_keywords": [],
            },
            {
                "name": "experience_relevance",
                "score": 100,
                "evidence": "Test",
                "missing_keywords": [],
            },
            {
                "name": "seniority_fit",
                "score": 100,
                "evidence": "Test",
                "missing_keywords": [],
            },
            {
                "name": "education_fit",
                "score": 100,
                "evidence": "Test",
                "missing_keywords": [],
            },
        ]
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        assert len(enriched) == 4
        # overall = round(100 * (0.35 + 0.30 + 0.20 + 0.15)) = round(100 * 1.0) = 100
        assert overall == 100

    def test_enrich_all_four_health_categories(self):
        """_enrich with all 4 HEALTH_CATEGORIES."""
        categories = [
            {
                "name": "clarity",
                "score": 100,
                "evidence": "Test",
                "tips": [],
            },
            {
                "name": "completeness",
                "score": 100,
                "evidence": "Test",
                "tips": [],
            },
            {
                "name": "impact_language",
                "score": 100,
                "evidence": "Test",
                "tips": [],
            },
            {
                "name": "ats_friendliness",
                "score": 100,
                "evidence": "Test",
                "tips": [],
            },
        ]
        enriched, overall = _enrich(categories, HEALTH_CATEGORIES)

        assert len(enriched) == 4
        # overall = round(100 * 1.0) = 100
        assert overall == 100

    def test_enrich_zero_scores(self):
        """_enrich with all scores at 0."""
        categories = [
            {
                "name": "skills_match",
                "score": 0,
                "evidence": "No skills",
                "missing_keywords": [],
            },
            {
                "name": "experience_relevance",
                "score": 0,
                "evidence": "No experience",
                "missing_keywords": [],
            },
        ]
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        assert overall == 0

    def test_enrich_mixed_scores(self):
        """_enrich with varied scores."""
        categories = [
            {
                "name": "skills_match",
                "score": 60,
                "evidence": "Test",
                "missing_keywords": [],
            },
            {
                "name": "experience_relevance",
                "score": 40,
                "evidence": "Test",
                "missing_keywords": [],
            },
        ]
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        # overall = round(60 * 0.35 + 40 * 0.30) = round(21 + 12) = 33
        assert overall == 33

    def test_enrich_rounding_behavior(self):
        """_enrich uses round() correctly (banker's rounding in Python 3)."""
        # Test case where rounding matters
        categories = [
            {
                "name": "clarity",
                "score": 50,
                "evidence": "Test",
                "tips": [],
            },
        ]
        enriched, overall = _enrich(categories, HEALTH_CATEGORIES)

        # overall = round(50 * 0.25) = round(12.5) = 12 (banker's rounding)
        # (Python 3 rounds to nearest even)
        assert isinstance(overall, int)

    def test_enrich_clamps_score_above_100(self):
        """_enrich clamps scores above 100 to 100 before calculating overall."""
        categories = [
            {
                "name": "skills_match",
                "score": 105,  # LLM out-of-range value
                "evidence": "Invalid score",
                "missing_keywords": [],
            },
        ]
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        assert enriched[0]["score"] == 100.0
        assert overall == round(100 * 0.35)  # clamped to 100

    def test_enrich_modifies_dict_in_place(self):
        """_enrich adds 'label' and 'weight' to original dicts (mutation)."""
        categories = [
            {
                "name": "skills_match",
                "score": 80,
                "evidence": "Test",
                "missing_keywords": [],
            },
        ]
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        # Original dict should now have label and weight added
        assert "label" in enriched[0]
        assert "weight" in enriched[0]
        assert enriched[0]["label"] == "Skills Match"
        assert enriched[0]["weight"] == 0.35


# ============================================================================
# 4. EDGE CASE INTEGRATION TESTS
# ============================================================================


class TestBugDetection:
    """Tests that detect bugs found by reviewer."""

    def test_overall_score_clamped_when_llm_returns_score_above_100(self):
        """_enrich clamps scores and overall_score stays within [0, 100]."""
        categories = [
            {"name": "skills_match", "score": 105, "evidence": "T", "missing_keywords": []},
            {"name": "experience_relevance", "score": 100, "evidence": "T", "missing_keywords": []},
            {"name": "seniority_fit", "score": 100, "evidence": "T", "missing_keywords": []},
            {"name": "education_fit", "score": 100, "evidence": "T", "missing_keywords": []},
        ]
        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        assert overall == 100
        # Should construct without ValidationError
        response = AnalyseResponse(
            overall_score=overall,
            categories=[MatchCategory(**c) for c in enriched],
            matched_keywords=[],
            explanation="Test",
            missing_keywords=[],
            suggestions=[],
        )
        assert response.overall_score == 100

    def test_overall_score_clamped_when_llm_returns_negative(self):
        """_enrich clamps negative scores to 0 and overall_score stays >= 0."""
        categories = [
            {
                "name": "skills_match",
                "score": -5,  # INVALID - negative
                "evidence": "Test",
                "missing_keywords": [],
            },
        ]

        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        assert enriched[0]["score"] == 0.0
        assert overall == 0
        # Should construct without ValidationError
        response = AnalyseResponse(
            overall_score=overall,
            categories=[MatchCategory(**c) for c in enriched],
            matched_keywords=[],
            explanation="Test",
            missing_keywords=[],
            suggestions=[],
        )
        assert response.overall_score == 0


class TestIntegrationScenarios:
    """Integration tests combining models and _enrich."""

    def test_enrich_then_create_analyse_response(self):
        """Typical flow: _enrich() then create AnalyseResponse."""
        categories = [
            {
                "name": "skills_match",
                "score": 80,
                "evidence": "Good skills",
                "missing_keywords": ["Docker"],
            },
            {
                "name": "experience_relevance",
                "score": 70,
                "evidence": "Some relevance",
                "missing_keywords": [],
            },
            {
                "name": "seniority_fit",
                "score": 85,
                "evidence": "Right level",
                "missing_keywords": [],
            },
            {
                "name": "education_fit",
                "score": 90,
                "evidence": "Good education",
                "missing_keywords": [],
            },
        ]

        enriched, overall = _enrich(categories, MATCH_CATEGORIES)

        # Now create AnalyseResponse (simulating API response)
        match_categories = [
            MatchCategory(**c) for c in enriched
        ]
        response = AnalyseResponse(
            overall_score=overall,
            categories=match_categories,
            matched_keywords=["Python", "PostgreSQL"],
            explanation="Good fit overall",
            missing_keywords=["Docker"],
            suggestions=["Learn Docker"],
        )

        assert response.overall_score > 0
        assert response.overall_score <= 100
        assert len(response.categories) == 4

    def test_enrich_then_create_cv_health_response(self):
        """Typical flow: _enrich() then create CVHealthResponse."""
        categories = [
            {
                "name": "clarity",
                "score": 88,
                "evidence": "Clear formatting",
                "tips": [],
            },
            {
                "name": "completeness",
                "score": 92,
                "evidence": "All sections",
                "tips": [],
            },
            {
                "name": "impact_language",
                "score": 78,
                "evidence": "Some metrics",
                "tips": ["Add more numbers"],
            },
            {
                "name": "ats_friendliness",
                "score": 95,
                "evidence": "Single column",
                "tips": [],
            },
        ]

        enriched, overall = _enrich(categories, HEALTH_CATEGORIES)

        # Create CVHealthResponse
        health_categories = [
            HealthCategory(**c) for c in enriched
        ]
        response = CVHealthResponse(
            overall_score=overall,
            categories=health_categories,
            weak_bullets=[],
            red_flags=[],
            quick_wins=["Add metrics to bullets"],
        )

        assert response.overall_score > 0
        assert response.overall_score <= 100
        assert len(response.categories) == 4

    def test_boundary_case_all_zeros(self):
        """All categories with score=0."""
        categories = [
            {
                "name": "skills_match",
                "score": 0,
                "evidence": "No match",
                "missing_keywords": [],
            },
            {
                "name": "experience_relevance",
                "score": 0,
                "evidence": "No experience",
                "missing_keywords": [],
            },
            {
                "name": "seniority_fit",
                "score": 0,
                "evidence": "Wrong level",
                "missing_keywords": [],
            },
            {
                "name": "education_fit",
                "score": 0,
                "evidence": "No education",
                "missing_keywords": [],
            },
        ]

        enriched, overall = _enrich(categories, MATCH_CATEGORIES)
        response = AnalyseResponse(
            overall_score=overall,
            categories=[MatchCategory(**c) for c in enriched],
            matched_keywords=[],
            explanation="No fit",
            missing_keywords=[],
            suggestions=[],
        )

        assert response.overall_score == 0

    def test_boundary_case_all_100(self):
        """All categories with score=100."""
        categories = [
            {
                "name": "clarity",
                "score": 100,
                "evidence": "Perfect",
                "tips": [],
            },
            {
                "name": "completeness",
                "score": 100,
                "evidence": "Perfect",
                "tips": [],
            },
            {
                "name": "impact_language",
                "score": 100,
                "evidence": "Perfect",
                "tips": [],
            },
            {
                "name": "ats_friendliness",
                "score": 100,
                "evidence": "Perfect",
                "tips": [],
            },
        ]

        enriched, overall = _enrich(categories, HEALTH_CATEGORIES)
        response = CVHealthResponse(
            overall_score=overall,
            categories=[HealthCategory(**c) for c in enriched],
            weak_bullets=[],
            red_flags=[],
            quick_wins=[],
        )

        assert response.overall_score == 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
