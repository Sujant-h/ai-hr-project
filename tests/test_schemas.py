"""The HTTP boundary must round-trip the models.py dataclasses exactly.

Anything lost here is lost silently: a dropped field shows up as a blank pill in
the UI, not as an error.
"""

from __future__ import annotations

from api.schemas import candidate_from_in, candidate_to_out, requirement_to_out
from models import Candidate, Gap, MatchResult, Requirement


def test_requirement_round_trips():
    req = Requirement(id="r0", label="Python", kind="skill", value="Python", importance="muss")
    out = requirement_to_out(req)
    assert out.id == "r0"
    assert out.kind == "skill"
    assert out.importance == "muss"


def test_candidate_round_trips_including_derived_fields():
    cand = Candidate(id="c0", name="Lena", source="cv.pdf", raw_text="CV text", skills=["Python"])
    cand.matches = [
        MatchResult(requirement_id="r0", label="Python", kind="skill",
                    importance="muss", status="erfuellt", note="gefunden")
    ]
    cand.gaps = [Gap(requirement_label="Kontaktdaten", description="fehlt", importance="muss")]
    cand.questions = ["Wie erreichen wir Sie?"]

    out = candidate_to_out(cand)
    assert out.name == "Lena"
    assert out.matches[0].status == "erfuellt"
    assert out.gaps[0].importance == "muss"
    assert out.questions == ["Wie erreichen wir Sie?"]


def test_candidate_survives_a_full_round_trip():
    """The client sends candidates back for analysis, so raw_text must survive."""
    cand = Candidate(id="c0", name="Lena", source="cv.pdf", raw_text="CV text", skills=["Python"])
    restored = candidate_from_in(candidate_to_out(cand))
    assert restored.raw_text == "CV text"
    assert restored.id == "c0"
    assert restored.skills == ["Python"]
