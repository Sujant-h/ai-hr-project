"""Shared test setup."""

from __future__ import annotations

import pytest

from api.main import limiter


@pytest.fixture(autouse=True)
def fresh_rate_limit():
    """Give every test the full rate-limit budget.

    `limiter` is a module-level singleton keyed per client, and the limits are
    per DAY. Without this, whichever tests happen to run first spend the budget
    and the rest see a 429 that has nothing to do with what they assert.
    """
    limiter.reset()
    yield
    limiter.reset()
