"""Regression tests for HTML escaping of untrusted data.

The app renders candidate data into raw HTML (unsafe_allow_html=True). That data
comes from uploaded CVs, filenames and LLM responses — all attacker-controlled —
so it must be escaped before interpolation.
"""

from __future__ import annotations

import app
from agents import rules

XSS_PAYLOAD = "<img src=x onerror=alert(1)>"


def test_cv_agent_name_is_attacker_controlled():
    """Documents the hazard the escaping defends against: cv_agent lifts the
    display name straight out of the uploaded document via regex, so whatever
    the CV says lands in Candidate.name."""
    cand = rules.cv_agent("Fallback-Name", "cv.pdf", f"Name: {XSS_PAYLOAD}", 0)
    assert XSS_PAYLOAD in cand.name


def test_escaping_neutralizes_a_script_payload():
    escaped = app._h(XSS_PAYLOAD)
    assert "<img" not in escaped
    assert escaped == "&lt;img src=x onerror=alert(1)&gt;"


def test_escaping_covers_attribute_context():
    """Escaped values are also interpolated into attributes (e.g. the mailto
    href), so quotes must not survive and break out."""
    escaped = app._h('" onmouseover="alert(1)')
    assert '"' not in escaped


def test_escaping_handles_non_string_values():
    """Call sites pass ints and None-able fields straight through."""
    assert app._h(7) == "7"
    assert app._h(None) == "None"


def test_uploaded_cv_name_is_safe_once_escaped():
    """End-to-end for the realistic vector: a malicious CV through the agent,
    then through the escaping the render sites apply."""
    cand = rules.cv_agent("Fallback-Name", "cv.pdf", f"Name: {XSS_PAYLOAD}", 0)
    rendered = f'<span class="nm">{app._h(cand.name)}</span>'
    assert "<img" not in rendered
    assert "&lt;img" in rendered


def test_llm_supplied_match_note_is_escaped():
    """Under the LLM backend the note text is model-controlled."""
    assert "<script" not in app._h("<script>alert(1)</script>")
