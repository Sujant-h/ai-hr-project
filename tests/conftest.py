"""Shared test setup.

api/main.py calls load_dotenv(override=True) at import, so whatever sits in a
developer's .env wins over the environment — including ACCESS_PASSWORD, which
makes every authenticated endpoint answer 401 and turns the API tests red on a
working checkout. The suite tests the app's behaviour, not the local .env, so
the password is cleared here.
"""

from __future__ import annotations

import pytest

from api import main
from api.main import limiter


@pytest.fixture(autouse=True)
def no_access_password(monkeypatch):
    # verify_password reads the module global at call time, so patching the
    # attribute is enough — no need to reimport the app.
    monkeypatch.setattr(main, "ACCESS_PASSWORD", None)


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
