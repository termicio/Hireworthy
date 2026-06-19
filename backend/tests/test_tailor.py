"""Tests for POST /tailor endpoint."""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import json


@pytest.mark.asyncio
async def test_tailor_valid_request(client):
    """Test successful CV tailoring with all fields provided."""
    request_data = {
        "cv": "Python Developer\nExperience:\n- 3 years Python\n- Django framework",
        "job_description": "Senior Python Backend Engineer - seeking 5+ years Python, FastAPI, PostgreSQL",
        "missing_keywords": ["FastAPI", "PostgreSQL", "async"],
        "suggestions": [
            "Emphasize async patterns in Python projects",
            "Add database optimization experience",
            "Highlight backend architecture work"
        ]
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        mock_tailor.return_value = """Python Backend Developer
Experience:
- 3 years Python (including async/await patterns)
- Django and FastAPI web frameworks
- PostgreSQL database optimization"""

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert "tailored_cv" in data
    assert "Python" in data["tailored_cv"]
    assert "FastAPI" in data["tailored_cv"]


@pytest.mark.asyncio
async def test_tailor_with_empty_optional_fields(client):
    """Test CV tailoring with minimal required fields (empty optional arrays)."""
    request_data = {
        "cv": "Software Engineer with 5 years experience",
        "job_description": "Backend Engineer needed",
        "missing_keywords": [],
        "suggestions": []
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        mock_tailor.return_value = "Tailored CV content here"

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 200
    data = response.json()
    assert data["tailored_cv"] == "Tailored CV content here"


@pytest.mark.asyncio
async def test_tailor_missing_cv_field(client):
    """Test that missing CV field returns 422 validation error."""
    request_data = {
        # Missing "cv" field
        "job_description": "Backend Engineer position",
        "missing_keywords": ["Python"],
        "suggestions": ["Add more details"]
    }

    response = client.post("/tailor/", json=request_data)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_tailor_missing_job_description_field(client):
    """Test that missing job_description field returns 422 validation error."""
    request_data = {
        "cv": "My CV content",
        # Missing "job_description" field
        "missing_keywords": ["Python"],
        "suggestions": ["Add more details"]
    }

    response = client.post("/tailor/", json=request_data)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_tailor_ai_failure(client):
    """Test that AI service failure returns 502 error."""
    request_data = {
        "cv": "Python Developer",
        "job_description": "Python Backend Engineer",
        "missing_keywords": ["FastAPI"],
        "suggestions": ["Add async/await"]
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        # Simulate AI service failure
        mock_tailor.side_effect = Exception("Anthropic API error: rate limit exceeded")

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 502
    assert "AI tailoring failed" in response.json()["detail"]


@pytest.mark.asyncio
async def test_tailor_ai_json_error(client):
    """Test that AI JSON parsing error is handled as 502."""
    request_data = {
        "cv": "My CV",
        "job_description": "Job description",
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        # Simulate JSON decode error from AI response
        mock_tailor.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_tailor_with_special_characters(client):
    """Test CV tailoring with special characters and formatting."""
    request_data = {
        "cv": "Python & C++ Developer\nSkills: AWS (EC2, S3), Docker {container}\n- Years: 5+",
        "job_description": "Seeking Python/C++ engineer with DevOps & cloud (AWS/Azure)",
        "missing_keywords": ["Azure", "Kubernetes"],
        "suggestions": []
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        mock_tailor.return_value = "Tailored CV with special chars & symbols preserved"

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 200
    assert "tailored_cv" in response.json()


@pytest.mark.asyncio
async def test_tailor_with_long_cv_content(client):
    """Test CV tailoring with large CV and job description content."""
    long_cv = "Professional Summary\n" + "\n".join([
        f"Skill {i}: {['Python', 'JavaScript', 'Go', 'Rust', 'Java'][i % 5]} - {10 + i} years"
        for i in range(50)
    ])
    long_job = "We're hiring for a senior engineer position. Required: " + ", ".join([
        f"Skill{i}" for i in range(20)
    ])

    request_data = {
        "cv": long_cv,
        "job_description": long_job,
        "missing_keywords": ["Kubernetes", "Prometheus", "gRPC", "Protocol Buffers"],
        "suggestions": [
            "Emphasize large-scale system experience",
            "Add cloud infrastructure examples",
            "Highlight DevOps tooling expertise"
        ]
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        mock_tailor.return_value = "Tailored large CV content"

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 200
    assert "tailored_cv" in response.json()


@pytest.mark.asyncio
async def test_tailor_with_many_missing_keywords(client):
    """Test CV tailoring with many missing keywords."""
    request_data = {
        "cv": "Software Engineer",
        "job_description": "Backend engineer needed",
        "missing_keywords": [
            "Python", "Go", "Rust", "Java", "C++",
            "PostgreSQL", "MongoDB", "Redis", "Kafka",
            "Docker", "Kubernetes", "AWS", "GCP", "Azure",
            "gRPC", "REST", "GraphQL", "SOAP"
        ],
        "suggestions": [
            "Add language expertise",
            "Detail database experience",
            "Show cloud infrastructure work"
        ]
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        mock_tailor.return_value = "Comprehensively tailored CV"

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_tailor_empty_cv_string(client):
    """Test that empty CV string is still accepted by API (validation at UI level)."""
    request_data = {
        "cv": "",
        "job_description": "Backend Engineer",
        "missing_keywords": [],
        "suggestions": []
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        # The API does accept it, but AI would fail
        # This tests that the API passes it through
        mock_tailor.side_effect = Exception("Cannot tailor empty CV")

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_tailor_invalid_json_in_request(client):
    """Test that invalid JSON in request body is rejected."""
    response = client.post(
        "/tailor/",
        content="not valid json",
        headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_tailor_response_model_validation(client):
    """Test that response is validated against TailorResponse model."""
    request_data = {
        "cv": "Python Developer",
        "job_description": "Python Backend Engineer",
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        mock_tailor.return_value = "Valid tailored CV response"

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 200
    data = response.json()
    # Ensure response has the expected structure
    assert isinstance(data, dict)
    assert "tailored_cv" in data
    assert isinstance(data["tailored_cv"], str)


@pytest.mark.asyncio
async def test_tailor_timeout_scenario(client):
    """Test handling of timeout from AI service (simulated as exception)."""
    request_data = {
        "cv": "Developer CV",
        "job_description": "Job description",
    }

    with patch("ai.tailor_cv", new_callable=AsyncMock) as mock_tailor:
        mock_tailor.side_effect = TimeoutError("Request to Anthropic API timed out")

        response = client.post("/tailor/", json=request_data)

    assert response.status_code == 502
    assert "AI tailoring failed" in response.json()["detail"]
