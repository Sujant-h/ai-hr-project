"""A public API on a paid key is an open LLM proxy without these limits."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import llm_agents
from api.main import app, limiter


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(llm_agents, "llm_available", lambda: False)
    limiter.reset()
    yield TestClient(app)
    # The burst test below deliberately exhausts the per-IP limit. Reset it
    # so that state doesn't leak into other test files sharing this same
    # module-level `limiter` (and app) instance.
    limiter.reset()


def test_cors_is_not_open_to_every_origin(client):
    """`*` would let any site spend the key from a visitor's browser."""
    response = client.options(
        "/api/job-profile",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert response.headers.get("access-control-allow-origin") != "*"


def test_the_configured_origin_is_allowed(client):
    response = client.options(
        "/api/job-profile",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_llm_endpoints_are_rate_limited(client):
    """Burst past the limit and expect a 429 rather than an unbounded bill."""
    codes = [
        client.post("/api/job-profile", json={"text": "Python"}).status_code
        for _ in range(35)
    ]
    assert 429 in codes, "no rate limit: the key is an open proxy"
