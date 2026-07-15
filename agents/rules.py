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
from models import EDU_LABELS, EDU_LEVELS, Candidate, Gap, MatchResult, Requirement

# =============================================================================
#  KNOWLEDGE BASE (deterministic demo extraction vocabulary)
# =============================================================================

SKILL_VOCAB = {
    "Python": ["python"],
    "Java": ["java"],
    "JavaScript": ["javascript", "js", "node"],
    "TypeScript": ["typescript", "ts"],
    "React": ["react"],
    "SQL": ["sql", "postgres", "mysql"],
    "AWS": ["aws", "amazon web services"],
    "Azure": ["azure"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "Machine Learning": ["machine learning", "ml", "tensorflow", "pytorch"],
    "Excel": ["excel"],
    "SAP": ["sap"],
    "Salesforce": ["salesforce"],
    "Projektmanagement": ["projektmanagement", "project management", "scrum", "agile", "kanban"],
    "Kommunikation": ["kommunikation", "communication"],
    "Vertrieb": ["vertrieb", "sales"],
    "Marketing": ["marketing", "seo", "sea"],
    "Buchhaltung": ["buchhaltung", "accounting", "rechnungswesen"],
}

LANGUAGE_VOCAB = {
    "Deutsch": ["deutsch", "german"],
    "Englisch": ["englisch", "english"],
    "Französisch": ["französisch", "franzosisch", "french"],
    "Spanisch": ["spanisch", "spanish"],
    "Italienisch": ["italienisch", "italian"],
}



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


def _detect_education(text: str) -> tuple:
    """Return (level:int, label:str) for the highest education found.

    Matching is whole-word: a plain substring test credits "Diplomarbeit" as a
    Diplom and "Masterarbeit" as a Master, promoting candidates to degrees they
    never claimed.
    """
    best = 0
    for key, level in EDU_LEVELS.items():
        if level <= best:  # cannot raise `best` — skip the scan
            continue
        if _mentions_education(text, key):
            best = level
    return best, EDU_LABELS.get(best, "unbekannt")


def _detect_email(text: str) -> Optional[str]:
    m = re.search(r"[\w.\-+]+@[\w.\-]+\.\w+", text)
    return m.group(0) if m else None


# --- Agent 1: Stellenprofil-Agent -------------------------------------------

def stellenprofil_agent(text: str) -> list:
    """Extract measurable requirements from a free-text job profile."""
    requirements: list = []

    def importance_for(snippet: str) -> str:
        nice = ["wünschenswert", "wunschenswert", "von vorteil", "nice to have", "kann", "optional"]
        low_snippet = snippet.lower()
        return "kann" if any(n in low_snippet for n in nice) else "muss"

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
                label=f"{years}+ Jahre Berufserfahrung",
                kind="experience",
                value=years,
                importance="muss",
            )
        )

    # Education
    edu_level, edu_label = _detect_education(text)
    if edu_level > 0:
        requirements.append(
            Requirement(
                id="education",
                label=f"Bildungsabschluss: {edu_label}",
                kind="education",
                value=edu_level,
                importance="muss",
            )
        )

    # Languages
    for lang in _find_terms(text, LANGUAGE_VOCAB):
        requirements.append(
            Requirement(
                id=f"lang_{lang.lower()}",
                label=f"Sprache: {lang}",
                kind="language",
                value=lang,
                importance="muss",
            )
        )

    return requirements


# --- Agent 2: CV-Agent ------------------------------------------------------

def cv_agent(name: str, source: str, text: str, idx: int) -> Candidate:
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
    edu_level, edu_label = _detect_education(text)
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
        education_label=edu_label if edu_level > 0 else "unbekannt",
        languages=languages,
        email=email,
    )


# --- Agent 3: Matching-Agent ------------------------------------------------

def matching_agent(candidate: Candidate, requirements: list) -> list:
    """Compare each requirement against the candidate's data (no ranking)."""
    results: list = []
    for req in requirements:
        status = "offen"
        note = ""

        if req.kind == "skill":
            if req.value in candidate.skills:
                status, note = "erfuellt", "Im Lebenslauf erwähnt."
            else:
                status, note = "offen", "Nicht im Lebenslauf erwähnt."

        elif req.kind == "experience":
            if candidate.years is None:
                status, note = "offen", "Keine Angabe zur Berufserfahrung gefunden."
            elif candidate.years >= int(req.value):
                status, note = "erfuellt", f"{candidate.years} Jahre angegeben."
            else:
                status, note = "teilweise", f"Nur {candidate.years} von {req.value} Jahren angegeben."

        elif req.kind == "education":
            if candidate.education == 0:
                status, note = "offen", "Kein Bildungsabschluss erkennbar."
            elif candidate.education >= int(req.value):
                status, note = "erfuellt", f"{candidate.education_label} vorhanden."
            else:
                status, note = "teilweise", f"{candidate.education_label} (gefordert: höher)."

        elif req.kind == "language":
            if req.value in candidate.languages:
                status, note = "erfuellt", "Sprache genannt."
            else:
                status, note = "offen", "Sprache nicht genannt."

        results.append(
            MatchResult(
                requirement_id=req.id,
                label=req.label,
                kind=req.kind,
                importance=req.importance,
                status=status,
                note=note,
            )
        )
    return results

# --- Agent 4: Informationslücken-Agent --------------------------------------

def informationsluecken_agent(candidate: Candidate, matches: list) -> list:
    """Identify missing or unclear information that blocks a clean assessment.

    Gaps on nice-to-have requirements are kept but marked "kann": they are worth
    showing the recruiter, yet asking a candidate about them as insistently as
    about a must-have turns the follow-up e-mail into noise. Must-haves come
    first for the same reason.
    """
    gaps: list = []
    for m in matches:
        if m.status in ("offen", "teilweise"):
            gaps.append(Gap(requirement_label=m.label, description=m.note, importance=m.importance))

    if not candidate.email:
        gaps.append(Gap(requirement_label="Kontaktdaten", description="Keine E-Mail-Adresse im Lebenslauf gefunden."))
    if candidate.years is None:
        gaps.append(Gap(requirement_label="Berufserfahrung", description="Dauer der Berufserfahrung unklar."))

    gaps.sort(key=lambda g: g.importance != "muss")  # stable: muss first
    return gaps


# --- Agent 5: Rückfragen-Agent ----------------------------------------------

def rueckfragen_agent(candidate: Candidate, gaps: list) -> list:
    """Generate polite, candidate-facing follow-up questions for each gap."""
    questions: list = []
    seen = set()
    for gap in gaps:
        label = gap.requirement_label
        if label in seen:
            continue
        seen.add(label)

        if label == "Kontaktdaten":
            q = "Könnten Sie uns bitte eine aktuelle E-Mail-Adresse für die Kontaktaufnahme nennen?"
        elif label == "Berufserfahrung":
            q = "Wie viele Jahre einschlägige Berufserfahrung bringen Sie insgesamt mit?"
        elif label.startswith("Sprache:"):
            lang = label.replace("Sprache:", "").strip()
            q = f"Auf welchem Niveau beherrschen Sie {lang}? (z. B. fließend, verhandlungssicher, Muttersprache)"
        elif label.startswith("Bildungsabschluss"):
            q = "Welchen höchsten Bildungsabschluss haben Sie und in welchem Fachbereich?"
        elif "Jahre Berufserfahrung" in label:
            q = "Könnten Sie Ihre relevante Berufserfahrung für diese Position kurz beschreiben?"
        else:
            q = f"Könnten Sie Ihre Erfahrung im Bereich „{label}“ näher erläutern?"

        questions.append(q)
    return questions


def generate_email(candidate: Candidate, selected_questions: list) -> tuple:
    """Compose a polite follow-up e-mail draft from the selected questions.

    Deterministic, template-based generation (no API key required). The draft
    is NEVER sent automatically — it is only prepared for human review.
    """
    to = candidate.email or "bewerber@example.com"
    subject = "Rückfragen zu Ihrer Bewerbung"
    lines = [
        f"Sehr geehrte/r {candidate.name},",
        "",
        "vielen Dank für Ihre Bewerbung und Ihr Interesse an der ausgeschriebenen "
        "Position. Um Ihre Unterlagen vollständig und fair bewerten zu können, "
        "hätten wir noch einige kurze Rückfragen an Sie:",
        "",
    ]
    for i, q in enumerate(selected_questions, 1):
        lines.append(f"{i}. {q}")
    lines += [
        "",
        "Über eine kurze Rückmeldung würden wir uns sehr freuen. Bei Fragen stehen "
        "wir Ihnen jederzeit gern zur Verfügung.",
        "",
        "Mit freundlichen Grüßen",
        "Ihr Recruiting-Team",
    ]
    return to, subject, "\n".join(lines)
