"""
Rule-based agents — the deterministic backend.

Every agent here is a pure function: it takes text or dataclasses and returns
structured output. Nothing in this module touches Streamlit, the network or
global state, which is what makes it directly testable.

The agents only EXTRACT and COMPARE. They never rank candidates, never score
them and never produce a hiring recommendation — see the module docstring in
app.py for the human-in-the-loop principle.

This is the fallback backend: it runs whenever no OPENAI_API_KEY is set or an
LLM call fails. Its vocabulary is a fixed keyword list, so treat it as
demo-grade extraction — llm_agents.py is the capable backend.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Optional

import llm_agents
from i18n import DEFAULT_LANG, edu_label, language_display, tr
from models import EDU_LEVELS, Candidate, Gap, MatchResult, Requirement

# The extraction vocabulary lives in vocabulary.py because the LLM backend needs
# it too, to canonicalize what the model gives back. Re-exported here: this
# module is where it has always been read from.
from vocabulary import LANGUAGE_VOCAB, SKILL_VOCAB


# =============================================================================
#  BACKEND / AGENT LOGIC
#  --------------------------------------------------------------------------
#  Every agent is a pure function: it takes input data and returns structured
#  output. None of them mutate global state or make hiring decisions.
# =============================================================================

@lru_cache(maxsize=None)
def _word_pattern(term: str) -> re.Pattern:
    """Case-insensitive whole-word matcher for `term`, compiled once."""
    return re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)


# German writes compounds as one word — "Englischkenntnisse", "SQL-Erfahrung",
# "Python-Entwickler" — so whole-word matching alone misses skills and languages
# that a job ad plainly states. Matching bare prefixes instead would be worse:
# "java" would then match "javascript". A synonym may therefore be followed by
# one of these qualifier suffixes (optionally hyphenated) and nothing else.
_COMPOUND_SUFFIXES = (
    "kenntnisse", "kenntnissen", "kenntnis",
    "erfahrung", "erfahrungen",
    "entwickler", "entwicklerin", "entwicklung",
    "experte", "expertin", "spezialist", "spezialistin",
    "skills",
)


@lru_cache(maxsize=None)
def _vocab_pattern(term: str) -> re.Pattern:
    """Whole-word matcher for `term` that also accepts German compound forms."""
    suffixes = "|".join(_COMPOUND_SUFFIXES)
    return re.compile(rf"\b{re.escape(term)}(?:-?(?:{suffixes}))?\b", re.IGNORECASE)


def _find_terms_with_context(text: str, vocab: dict) -> list:
    """Return (canonical_name, source_line) for each vocab entry found in `text`.

    The source line is the line the synonym actually matched on. Callers need it
    to judge context: looking the canonical name up again afterwards silently
    misses every term that was found through a synonym.
    """
    found = []
    lines = text.splitlines()
    for canonical, synonyms in vocab.items():
        match_line = next(
            (
                line
                for syn in synonyms
                for line in lines
                if _vocab_pattern(syn).search(line)
            ),
            None,
        )
        if match_line is not None:
            found.append((canonical, match_line))
    return found


def _find_terms(text: str, vocab: dict) -> list:
    """Return the canonical names whose synonyms appear in `text`."""
    return [canonical for canonical, _ in _find_terms_with_context(text, vocab)]


def _detect_years(text: str) -> Optional[int]:
    """Extract the largest stated number of years of experience."""
    matches = re.findall(r"(\d{1,2})\s*\+?\s*(?:jahre|jahren|years?|j\.)", text.lower())
    nums = [int(m) for m in matches if int(m) <= 50]
    return max(nums) if nums else None


# "Ausbildung" doubles as the standard German CV section header, so the bare
# word on its own line says nothing about a completed qualification.
_BARE_AUSBILDUNG_HEADER = re.compile(r"^\s*ausbildung\s*:?\s*$", re.IGNORECASE)


def _mentions_education(text: str, key: str) -> bool:
    """True when `key` appears as a stated qualification rather than a header."""
    pattern = _word_pattern(key)
    for line in text.splitlines():
        if not pattern.search(line):
            continue
        if key == "ausbildung" and _BARE_AUSBILDUNG_HEADER.match(line):
            continue
        return True
    return False


def _detect_education(text: str) -> int:
    """Return the level of the highest education found, 0 for none.

    Matching is whole-word: a plain substring test credits "Diplomarbeit" as a
    Diplom and "Masterarbeit" as a Master, promoting candidates to degrees they
    never claimed.

    Only the level is returned. The name of that level is display text and
    depends on the recruiter's language, so it is the caller's business — see
    i18n.edu_label.
    """
    best = 0
    for key, level in EDU_LEVELS.items():
        if level <= best:  # cannot raise `best` — skip the scan
            continue
        if _mentions_education(text, key):
            best = level
    return best


def _detect_email(text: str) -> Optional[str]:
    m = re.search(r"[\w.\-+]+@[\w.\-]+\.\w+", text)
    return m.group(0) if m else None


# --- Agent 1: Stellenprofil-Agent -------------------------------------------

def stellenprofil_agent(text: str, lang: str = DEFAULT_LANG) -> list:
    """Extract measurable requirements from a free-text job profile.

    `lang` governs the requirement labels only. What is extracted never depends
    on it: the vocabulary is matched against the document, not against the
    recruiter's UI language.
    """
    requirements: list = []

    # Markers that demote a requirement to a nice-to-have. Multilingual because
    # they are matched against the job ad, whose language is the author's — an
    # English ad saying "desirable" must not be read as mandatory just because
    # the recruiter's UI happens to be German, or vice versa.
    nice_markers = [
        "wünschenswert", "wunschenswert", "von vorteil", "idealerweise", "kann", "optional",
        "nice to have", "nice-to-have", "desirable", "preferred", "a plus", "an advantage",
        "advantageous", "ideally", "bonus",
    ]

    def importance_for(snippet: str) -> str:
        low_snippet = snippet.lower()
        return "kann" if any(n in low_snippet for n in nice_markers) else "muss"

    # Skills — importance is judged on the line the skill was actually matched
    # on, which is not necessarily a line containing its canonical name.
    for skill, source_line in _find_terms_with_context(text, SKILL_VOCAB):
        requirements.append(
            Requirement(
                id=f"skill_{skill.lower().replace(' ', '_')}",
                label=skill,
                kind="skill",
                value=skill,
                importance=importance_for(source_line),
            )
        )

    # Experience (years)
    years = _detect_years(text)
    if years:
        requirements.append(
            Requirement(
                id="exp_years",
                label=tr("req.experience", lang, years=years),
                kind="experience",
                value=years,
                importance="muss",
            )
        )

    # Education
    edu_level = _detect_education(text)
    if edu_level > 0:
        requirements.append(
            Requirement(
                id="education",
                label=tr("req.education", lang, label=edu_label(edu_level, lang)),
                kind="education",
                value=edu_level,
                importance="muss",
            )
        )

    # Languages
    for language in _find_terms(text, LANGUAGE_VOCAB):
        requirements.append(
            Requirement(
                id=f"lang_{language.lower()}",
                label=tr("req.language", lang, language=language_display(language, lang)),
                kind="language",
                value=language,
                importance="muss",
            )
        )

    return requirements


# --- Agent 2: CV-Agent ------------------------------------------------------

def cv_agent(name: str, source: str, text: str, idx: int, lang: str = DEFAULT_LANG) -> Candidate:
    """Extract structured candidate information from raw CV text."""
    # Data minimization (Art. 5 GDPR / AGG): strip demographic lines BEFORE they
    # are stored. `raw_text` is later reused as the CV for the matching call, so
    # redacting here guarantees demographics never reach the API even when this
    # rule-based fallback produced the candidate (defense in depth — the LLM path
    # already redacts in cv_agent_llm).
    text = llm_agents.redact_demographics(text)
    skills = _find_terms(text, SKILL_VOCAB)
    languages = _find_terms(text, LANGUAGE_VOCAB)
    years = _detect_years(text)
    edu_level = _detect_education(text)
    email = _detect_email(text)

    # Try to find a human-readable name from a "Name:" line, else use given name.
    display_name = name
    m = re.search(r"name\s*[:\-]\s*(.+)", text, re.IGNORECASE)
    if m:
        candidate_line = m.group(1).strip().splitlines()[0]
        if 2 < len(candidate_line) < 60:
            display_name = candidate_line

    return Candidate(
        id=f"cand_{idx}",
        name=display_name,
        source=source,
        raw_text=text,
        skills=skills,
        years=years,
        education=edu_level,
        education_label=edu_label(edu_level, lang) if edu_level > 0 else tr("edu.unknown", lang),
        languages=languages,
        email=email,
    )


# --- Agent 3: Matching-Agent ------------------------------------------------

def matching_agent(candidate: Candidate, requirements: list, lang: str = DEFAULT_LANG) -> list:
    """Compare each requirement against the candidate's data (no ranking)."""
    results: list = []
    for req in requirements:
        status = "offen"
        note = ""

        if req.kind == "skill":
            if req.value in candidate.skills:
                status, note = "erfuellt", tr("note.skill.met", lang)
            else:
                status, note = "offen", tr("note.skill.open", lang)

        elif req.kind == "experience":
            if candidate.years is None:
                status, note = "offen", tr("note.experience.missing", lang)
            elif candidate.years >= int(req.value):
                status, note = "erfuellt", tr("note.experience.met", lang, years=candidate.years)
            else:
                status, note = "teilweise", tr(
                    "note.experience.partial", lang, years=candidate.years, required=req.value
                )

        elif req.kind == "education":
            # The level, not the stored label: `education_label` was written in
            # whatever language the CV was uploaded under, and this note has to
            # be in the language of THIS request.
            level = edu_label(candidate.education, lang)
            if candidate.education == 0:
                status, note = "offen", tr("note.education.missing", lang)
            elif candidate.education >= int(req.value):
                status, note = "erfuellt", tr("note.education.met", lang, label=level)
            else:
                status, note = "teilweise", tr("note.education.partial", lang, label=level)

        elif req.kind == "language":
            if req.value in candidate.languages:
                status, note = "erfuellt", tr("note.language.met", lang)
            else:
                status, note = "offen", tr("note.language.open", lang)

        results.append(
            MatchResult(
                requirement_id=req.id,
                label=req.label,
                kind=req.kind,
                importance=req.importance,
                status=status,
                note=note,
                value=req.value,
            )
        )
    return results

# --- Agent 4: Informationslücken-Agent --------------------------------------

def informationsluecken_agent(candidate: Candidate, matches: list, lang: str = DEFAULT_LANG) -> list:
    """Identify missing or unclear information that blocks a clean assessment.

    Gaps on nice-to-have requirements are kept but marked "kann": they are worth
    showing the recruiter, yet asking a candidate about them as insistently as
    about a must-have turns the follow-up e-mail into noise. Must-haves come
    first for the same reason.
    """
    gaps: list = []
    for m in matches:
        if m.status in ("offen", "teilweise"):
            gaps.append(
                Gap(
                    requirement_label=m.label,
                    description=m.note,
                    importance=m.importance,
                    kind=m.kind,
                    value=m.value,
                )
            )

    if not candidate.email:
        gaps.append(
            Gap(
                requirement_label=tr("gap.contact.label", lang),
                description=tr("gap.contact.description", lang),
                kind="contact",
            )
        )
    if candidate.years is None:
        gaps.append(
            Gap(
                requirement_label=tr("gap.experience.label", lang),
                description=tr("gap.experience.description", lang),
                kind="experience_years",
            )
        )

    gaps.sort(key=lambda g: g.importance != "muss")  # stable: muss first
    return gaps


# --- Agent 5: Rückfragen-Agent ----------------------------------------------

def rueckfragen_agent(candidate: Candidate, gaps: list, lang: str = DEFAULT_LANG) -> list:
    """Generate polite, candidate-facing follow-up questions for each gap.

    Which question a gap gets is decided by `gap.kind` — a stable code — not by
    reading its label. The label is prose in the recruiter's language, so
    matching on it would silently produce the generic skill question for every
    gap the moment the UI was switched to another language.
    """
    questions: list = []
    seen = set()
    for gap in gaps:
        label = gap.requirement_label
        if label in seen:
            continue
        seen.add(label)

        if gap.kind == "contact":
            q = tr("question.contact", lang)
        elif gap.kind == "experience_years":
            q = tr("question.experience_years", lang)
        elif gap.kind == "language":
            q = tr("question.language", lang, language=language_display(str(gap.value), lang))
        elif gap.kind == "education":
            q = tr("question.education", lang)
        elif gap.kind == "experience":
            q = tr("question.experience", lang)
        else:
            q = tr("question.skill", lang, label=label)

        questions.append(q)
    return questions


def generate_email(candidate: Candidate, selected_questions: list, lang: str = DEFAULT_LANG) -> tuple:
    """Compose a polite follow-up e-mail draft from the selected questions.

    Deterministic, template-based generation (no API key required). The draft
    is NEVER sent automatically — it is only prepared for human review.
    """
    to = candidate.email or tr("email.fallback_address", lang)
    subject = tr("email.subject", lang)
    lines = [
        tr("email.greeting", lang, name=candidate.name),
        "",
        tr("email.intro", lang),
        "",
    ]
    for i, q in enumerate(selected_questions, 1):
        lines.append(f"{i}. {q}")
    lines += [
        "",
        tr("email.outro", lang),
        "",
        tr("email.signoff", lang),
        tr("email.team", lang),
    ]
    return to, subject, "\n".join(lines)
