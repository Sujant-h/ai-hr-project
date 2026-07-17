"""The canonical vocabulary both backends agree on.

Lives here rather than in agents/rules.py because BOTH backends need it and
rules.py already imports llm_agents — putting it in either one would make the
import circular.

Two rules govern this module:

  * The KEY is the canonical value the agents compare on. It is English in every
    entry and is never translated. It travels to the client inside
    `Requirement.value` and `Candidate.skills`, and comes back on a later request
    that may carry a different `lang`. A canonical that moved with the
    recruiter's language would make "Englisch" stop satisfying "English" the
    moment they flipped the switch.
  * The VALUES are detection synonyms and stay multilingual: they are matched
    against a document, whose language is the author's and has nothing to do
    with the UI's.

The synonyms double as a canonicalization table — see `canonicalize`. The LLM
backend is told to emit canonical English, but an instruction is a request, not
a guarantee: gpt-4o-mini returns "Projektmanagement" for a German job ad however
firmly the prompt says otherwise. Normalising its output here is what actually
holds the invariant.
"""

from __future__ import annotations

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
    "Project Management": ["projektmanagement", "project management", "scrum", "agile", "kanban"],
    "Communication": ["kommunikation", "communication"],
    "Sales": ["vertrieb", "sales"],
    "Marketing": ["marketing", "seo", "sea"],
    "Accounting": ["buchhaltung", "accounting", "rechnungswesen"],
    "IT Security": ["it-sicherheit", "it security", "cyber security", "it-forensik", "penetration testing"],
    "Computer Science": ["informatik", "computer science"],
    "Business Informatics": ["wirtschaftsinformatik"],
    "Natural Sciences": ["naturwissenschaften"],
    "Solution-Oriented": ["lösungsorientiert", "solution-oriented", "solution oriented"],
}

LANGUAGE_VOCAB = {
    "German": ["deutsch", "german"],
    "English": ["englisch", "english"],
    "French": ["französisch", "franzosisch", "french"],
    "Spanish": ["spanisch", "spanish"],
    "Italian": ["italienisch", "italian"],
}


def canonicalize(term: str, vocab: dict) -> str:
    """Map a freely extracted term onto its canonical English name.

    An unknown term is returned trimmed but otherwise untouched: the LLM backend
    is not limited to this vocabulary, and dropping a skill it found would be far
    worse than showing it in the model's own words.
    """
    cleaned = str(term).strip()
    low = cleaned.lower()
    for canonical, synonyms in vocab.items():
        if low == canonical.lower() or low in synonyms:
            return canonical
    return cleaned


def canonicalize_all(terms, vocab: dict) -> list:
    """Canonicalize a list, dropping the duplicates that collapsing can create.

    Several synonyms share one canonical — "Scrum" and "Projektmanagement" are
    both "Project Management" — so a model that correctly returned two distinct
    terms yields the same name twice. The UI keys its skill badges on the name
    and counts the list, so the duplicate would mean a React key collision and an
    inflated "skills detected" figure.

    Order is preserved: it is the order the model reported, and reordering a
    candidate's skills would look like a ranking.
    """
    seen: set = set()
    out: list = []
    for term in terms:
        canonical = canonicalize(term, vocab)
        if not canonical or canonical in seen:
            continue
        seen.add(canonical)
        out.append(canonical)
    return out
