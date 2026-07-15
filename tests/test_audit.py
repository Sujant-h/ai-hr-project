"""Regression tests for audit-trail accuracy.

The audit log is this app's EU AI Act transparency record, so it must state
which backend actually produced each result. Previously the batch summary
reported whichever backend happened to run last, hiding per-item fallbacks.
"""

from __future__ import annotations

from agents.dispatch import summarize_backends


def test_mixed_backends_are_all_reported():
    """The bug: a batch where one candidate fell back to rules and the next
    succeeded via the LLM was logged as if the LLM had processed all of them."""
    summary = summarize_backends(["regelbasiert", "LLM (gpt-4o-mini)", "LLM (gpt-4o-mini)"])
    assert "regelbasiert" in summary, f"fallback hidden from the audit trail: {summary!r}"
    assert "LLM (gpt-4o-mini)" in summary
    assert "2x LLM (gpt-4o-mini)" in summary
    assert "1x regelbasiert" in summary


def test_single_backend_is_reported_with_its_count():
    assert summarize_backends(["regelbasiert"]) == "1x regelbasiert"


def test_uniform_batch_is_reported_once():
    assert summarize_backends(["regelbasiert"] * 3) == "3x regelbasiert"


def test_empty_batch_does_not_claim_a_backend():
    assert summarize_backends([]) == "keine"
