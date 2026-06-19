"""Pytest configuration and fixtures."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def mock_database(monkeypatch):
    """Mock the database pool initialization."""
    async def mock_create_pool():
        pass

    async def mock_close_pool():
        pass

    monkeypatch.setattr("database.create_pool", mock_create_pool)
    monkeypatch.setattr("database.close_pool", mock_close_pool)
