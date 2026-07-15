"""Regression tests for the app's boot-time appearance.

static/styles.css is injected with st.markdown while the script runs, so it only
reaches the browser once the websocket delivers the first deltas. Until then the
browser paints Streamlit's stock shell — which is why a cold load used to show
the default "Deploy" toolbar and a white page before the real design appeared.

.streamlit/config.toml is the only part of the look that Streamlit applies
without waiting for the script, so these tests pin the two things that close that
gap: the toolbar must never render, and the boot colours must match the tokens
styles.css goes on to use (otherwise the first paint visibly changes colour).
"""

from __future__ import annotations

import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / ".streamlit" / "config.toml"
CSS_PATH = ROOT / "static" / "styles.css"


def _config() -> dict:
    with CONFIG_PATH.open("rb") as fh:
        return tomllib.load(fh)


def test_config_file_ships_with_the_app():
    """It must be committed, not just present on one machine: the Dockerfile
    copies the tree in, and without this file the container boots stock chrome."""
    assert CONFIG_PATH.is_file(), f"missing {CONFIG_PATH}"


def test_toolbar_never_renders():
    """'minimal' keeps the Deploy button and developer menu out of the document
    entirely, so they cannot flash before styles.css hides them."""
    assert _config()["client"]["toolbarMode"] == "minimal"


def test_boot_theme_matches_the_stylesheet_tokens():
    """The boot colours are a duplicate of values in styles.css — Streamlit has
    no way to read the stylesheet. If someone retunes the palette there without
    updating config.toml, the first paint flashes the old colour, so fail loudly.
    """
    theme = _config()["theme"]
    css = CSS_PATH.read_text(encoding="utf-8")

    assert theme["base"] == "light"
    # --rai-purple and --rai-ink must still be defined as the config claims.
    assert "--rai-purple:#7c5cff" in css.replace(" ", "")
    assert "--rai-ink:#0f1226" in css.replace(" ", "")
    assert theme["primaryColor"].lower() == "#7c5cff"
    assert theme["textColor"].lower() == "#0f1226"
    # The background must match the first stop of the .stApp gradient, or the
    # page changes colour the moment the stylesheet lands.
    assert theme["backgroundColor"].lower() == "#f7f6ff"
    assert "#f7f6ff" in css


def test_streamlit_parses_the_config_we_wrote():
    """Guards against a typo'd key silently falling back to the default: an
    unknown option in config.toml is not an error, it is just ignored."""
    import streamlit.config as st_config

    st_config.get_config_options(force_reparse=True)
    assert st_config.get_option("client.toolbarMode") == "minimal"
    assert st_config.get_option("theme.backgroundColor") == "#f7f6ff"
    assert st_config.get_option("theme.primaryColor") == "#7c5cff"
