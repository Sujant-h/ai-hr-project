"""User-facing strings for the agents, in every language the UI offers.

The agents produce prose the recruiter reads directly — match notes, gap
descriptions, follow-up questions, e-mail drafts and the audit trail. That text
has to follow the language the recruiter picked in the UI, so every function
that builds it takes a `lang` and looks its wording up here rather than
inlining a literal.

Only prose lives here. The vocabularies the code branches on — `status`,
`importance`, `kind`, education levels — stay as language-neutral codes on the
wire and are translated in the frontend. Translating a value the backend later
compares against would turn a language switch into a logic bug.
"""

from __future__ import annotations

from typing import Literal

Lang = Literal["en", "de"]

DEFAULT_LANG: Lang = "en"

# Agent identities. The audit log names the agent that produced each entry, so
# the name is display text — but it is also passed between functions, hence the
# stable key.
AGENT_JOB_PROFILE = "agent.job_profile"
AGENT_CV = "agent.cv"
AGENT_MATCHING = "agent.matching"
AGENT_GAPS = "agent.gaps"
AGENT_QUESTIONS = "agent.questions"

_EN: dict[str, str] = {
    # --- Agent names --------------------------------------------------------
    AGENT_JOB_PROFILE: "Job Profile Agent",
    AGENT_CV: "CV Agent",
    AGENT_MATCHING: "Matching Agent",
    AGENT_GAPS: "Information Gap Agent",
    AGENT_QUESTIONS: "Follow-up Question Agent",
    # --- Audit trail --------------------------------------------------------
    "audit.fallback.action": "LLM error — fell back to rules",
    "audit.job_profile.action": "Job profile analyzed",
    "audit.job_profile.detail": "{count} requirement(s) detected (backend: {backend}).",
    "audit.cv.action": "CV analyzed",
    "audit.cv.detail": "{name} processed (backend: {backend}).",
    "audit.matching.action": "Requirements compared",
    "audit.matching.detail": (
        "{candidates} candidate(s) checked against {requirements} "
        "requirement(s) (backend: {backends})."
    ),
    "audit.gaps.action": "Gaps analyzed",
    "audit.gaps.detail": "Missing details identified per candidate.",
    "audit.questions.action": "Follow-up questions generated",
    "audit.questions.detail": "Polite follow-up questions created for each information gap.",
    # --- Backend labels -----------------------------------------------------
    "backend.rule_based": "rule-based",
    "backend.llm": "LLM ({model})",
    "backend.none": "none",
    # --- Education levels ---------------------------------------------------
    "edu.0": "no degree",
    "edu.1": "vocational training",
    "edu.2": "Bachelor",
    "edu.3": "Master / Diploma",
    "edu.4": "Doctorate",
    "edu.unknown": "unknown",
    # --- Requirement labels (rule-based extraction) -------------------------
    "req.experience": "{years}+ years of experience",
    "req.education": "Education: {label}",
    "req.language": "Language: {language}",
    # --- Spoken language names (see language_display) -----------------------
    "language.German": "German",
    "language.English": "English",
    "language.French": "French",
    "language.Spanish": "Spanish",
    "language.Italian": "Italian",
    # --- Match notes --------------------------------------------------------
    "note.skill.met": "Mentioned in the CV.",
    "note.skill.open": "Not mentioned in the CV.",
    "note.experience.missing": "No information on professional experience found.",
    "note.experience.met": "{years} years stated.",
    "note.experience.partial": "Only {years} of {required} years stated.",
    "note.education.missing": "No educational qualification identifiable.",
    "note.education.met": "{label} on record.",
    "note.education.partial": "{label} (required: higher).",
    "note.language.met": "Language stated.",
    "note.language.open": "Language not stated.",
    "note.llm.no_reason": "No explanation provided.",
    "note.llm.unanswered": "Not answered by the Matching Agent — please check manually.",
    # --- Information gaps ---------------------------------------------------
    "gap.contact.label": "Contact details",
    "gap.contact.description": "No email address found in the CV.",
    "gap.experience.label": "Professional experience",
    "gap.experience.description": "Length of professional experience unclear.",
    # --- Follow-up questions ------------------------------------------------
    "question.contact": "Could you please give us a current email address so we can get in touch?",
    "question.experience_years": "How many years of relevant professional experience do you have in total?",
    "question.language": "At what level do you speak {language}? (e.g. fluent, business fluent, native)",
    "question.education": "What is your highest educational qualification, and in which field?",
    "question.experience": "Could you briefly describe your relevant professional experience for this position?",
    "question.skill": "Could you tell us more about your experience with “{label}”?",
    # --- Follow-up e-mail ---------------------------------------------------
    "email.fallback_address": "applicant@example.com",
    "email.subject": "Questions about your application",
    "email.greeting": "Dear {name},",
    "email.intro": (
        "thank you for your application and your interest in the advertised "
        "position. So that we can assess your documents completely and fairly, "
        "we have a few brief questions for you:"
    ),
    "email.outro": (
        "We would be delighted to hear back from you. If you have any questions, "
        "we are always happy to help."
    ),
    "email.signoff": "Kind regards",
    "email.team": "Your Recruiting Team",
    # --- Errors -------------------------------------------------------------
    "error.file_too_large": "File too large (max. 10 MB).",
    "error.no_input": "Neither a file nor text was submitted.",
    "source.pasted_text": "Pasted text",
    "llm.refusal": "The model refused the extraction ({schema}): {reason}",
    "llm.no_content": "The LLM returned no content ({schema}).",
    "llm.call_failed": "LLM call failed ({schema}): {error}",
}

_DE: dict[str, str] = {
    # --- Agent names --------------------------------------------------------
    AGENT_JOB_PROFILE: "Stellenprofil-Agent",
    AGENT_CV: "CV-Agent",
    AGENT_MATCHING: "Matching-Agent",
    AGENT_GAPS: "Informationslücken-Agent",
    AGENT_QUESTIONS: "Rückfragen-Agent",
    # --- Audit trail --------------------------------------------------------
    "audit.fallback.action": "LLM-Fehler — Fallback auf Regeln",
    "audit.job_profile.action": "Stellenprofil analysiert",
    "audit.job_profile.detail": "{count} Anforderung(en) erkannt (Backend: {backend}).",
    "audit.cv.action": "Lebenslauf analysiert",
    "audit.cv.detail": "{name} verarbeitet (Backend: {backend}).",
    "audit.matching.action": "Anforderungsabgleich durchgeführt",
    "audit.matching.detail": (
        "{candidates} Kandidat(en) gegen {requirements} "
        "Anforderung(en) geprüft (Backend: {backends})."
    ),
    "audit.gaps.action": "Lücken analysiert",
    "audit.gaps.detail": "Fehlende Angaben pro Kandidat ermittelt.",
    "audit.questions.action": "Rückfragen generiert",
    "audit.questions.detail": "Höfliche Rückfragen je Informationslücke erstellt.",
    # --- Backend labels -----------------------------------------------------
    "backend.rule_based": "regelbasiert",
    "backend.llm": "LLM ({model})",
    "backend.none": "keine",
    # --- Education levels ---------------------------------------------------
    "edu.0": "kein Abschluss",
    "edu.1": "Ausbildung",
    "edu.2": "Bachelor",
    "edu.3": "Master / Diplom",
    "edu.4": "Promotion",
    "edu.unknown": "unbekannt",
    # --- Requirement labels (rule-based extraction) -------------------------
    "req.experience": "{years}+ Jahre Berufserfahrung",
    "req.education": "Bildungsabschluss: {label}",
    "req.language": "Sprache: {language}",
    # --- Spoken language names (see language_display) -----------------------
    "language.German": "Deutsch",
    "language.English": "Englisch",
    "language.French": "Französisch",
    "language.Spanish": "Spanisch",
    "language.Italian": "Italienisch",
    # --- Match notes --------------------------------------------------------
    "note.skill.met": "Im Lebenslauf erwähnt.",
    "note.skill.open": "Nicht im Lebenslauf erwähnt.",
    "note.experience.missing": "Keine Angabe zur Berufserfahrung gefunden.",
    "note.experience.met": "{years} Jahre angegeben.",
    "note.experience.partial": "Nur {years} von {required} Jahren angegeben.",
    "note.education.missing": "Kein Bildungsabschluss erkennbar.",
    "note.education.met": "{label} vorhanden.",
    "note.education.partial": "{label} (gefordert: höher).",
    "note.language.met": "Sprache genannt.",
    "note.language.open": "Sprache nicht genannt.",
    "note.llm.no_reason": "Keine Begründung geliefert.",
    "note.llm.unanswered": "Vom Matching-Agent nicht beantwortet — bitte manuell prüfen.",
    # --- Information gaps ---------------------------------------------------
    "gap.contact.label": "Kontaktdaten",
    "gap.contact.description": "Keine E-Mail-Adresse im Lebenslauf gefunden.",
    "gap.experience.label": "Berufserfahrung",
    "gap.experience.description": "Dauer der Berufserfahrung unklar.",
    # --- Follow-up questions ------------------------------------------------
    "question.contact": "Könnten Sie uns bitte eine aktuelle E-Mail-Adresse für die Kontaktaufnahme nennen?",
    "question.experience_years": "Wie viele Jahre einschlägige Berufserfahrung bringen Sie insgesamt mit?",
    "question.language": "Auf welchem Niveau beherrschen Sie {language}? (z. B. fließend, verhandlungssicher, Muttersprache)",
    "question.education": "Welchen höchsten Bildungsabschluss haben Sie und in welchem Fachbereich?",
    "question.experience": "Könnten Sie Ihre relevante Berufserfahrung für diese Position kurz beschreiben?",
    "question.skill": "Könnten Sie Ihre Erfahrung im Bereich „{label}“ näher erläutern?",
    # --- Follow-up e-mail ---------------------------------------------------
    "email.fallback_address": "bewerber@example.com",
    "email.subject": "Rückfragen zu Ihrer Bewerbung",
    "email.greeting": "Sehr geehrte/r {name},",
    "email.intro": (
        "vielen Dank für Ihre Bewerbung und Ihr Interesse an der ausgeschriebenen "
        "Position. Um Ihre Unterlagen vollständig und fair bewerten zu können, "
        "hätten wir noch einige kurze Rückfragen an Sie:"
    ),
    "email.outro": (
        "Über eine kurze Rückmeldung würden wir uns sehr freuen. Bei Fragen stehen "
        "wir Ihnen jederzeit gern zur Verfügung."
    ),
    "email.signoff": "Mit freundlichen Grüßen",
    "email.team": "Ihr Recruiting-Team",
    # --- Errors -------------------------------------------------------------
    "error.file_too_large": "Datei zu groß (max. 10 MB).",
    "error.no_input": "Weder Datei noch Text übermittelt.",
    "source.pasted_text": "Eingefügter Text",
    "llm.refusal": "Modell hat die Extraktion verweigert ({schema}): {reason}",
    "llm.no_content": "LLM lieferte keinen Inhalt ({schema}).",
    "llm.call_failed": "LLM-Aufruf fehlgeschlagen ({schema}): {error}",
}

CATALOG: dict[str, dict[str, str]] = {"en": _EN, "de": _DE}

# The language the LLM prompts name explicitly. Asking for "German" gets a far
# more reliable answer than asking for "de".
LANG_NAMES: dict[str, str] = {"en": "English", "de": "German"}


def normalize_lang(lang: str | None) -> Lang:
    """Coerce anything the wire offers to a language we actually have strings for."""
    return lang if lang in CATALOG else DEFAULT_LANG  # type: ignore[return-value]


def tr(key: str, lang: str = DEFAULT_LANG, **params: object) -> str:
    """Look `key` up in `lang`, falling back to English and then to the key.

    Returning the key rather than raising is deliberate: a missing string should
    show up as an obvious `note.skill.met` in the UI, not take down a screening
    run mid-analysis.
    """
    catalog = CATALOG[normalize_lang(lang)]
    template = catalog.get(key) or _EN.get(key)
    if template is None:
        return key
    return template.format(**params) if params else template


def edu_label(level: int, lang: str = DEFAULT_LANG) -> str:
    """Human-readable name for an education level, or "unknown" for an unmapped one."""
    key = f"edu.{level}"
    if key not in _EN:
        return tr("edu.unknown", lang)
    return tr(key, lang)


def lang_name(lang: str = DEFAULT_LANG) -> str:
    """The English name of `lang`, for use inside a prompt."""
    return LANG_NAMES[normalize_lang(lang)]


def language_display(canonical: str, lang: str = DEFAULT_LANG) -> str:
    """Render a spoken language's canonical (English) name in `lang`.

    Unknown names pass through unchanged. The LLM backend extracts languages as
    free text and is not restricted to the rule-based vocabulary, so this has to
    degrade to showing what it was given rather than dropping it.
    """
    return tr(f"language.{canonical}", lang) if f"language.{canonical}" in _EN else canonical
