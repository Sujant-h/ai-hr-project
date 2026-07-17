"""Seed data for the "Load demo data" flow.

Lives outside app.py so both the Streamlit UI and the API can serve it without
either importing the other.

The demo exists to show the agents working on a realistic document, so the
sample job ad and CVs are written in the recruiter's own language rather than
translated on the fly: a German recruiter clicking "Demo-Daten laden" should get
a German job ad, and an English one an English ad. Both sets are built to
extract the same way, so the walkthrough tells the same story either way.
"""

from __future__ import annotations

from i18n import DEFAULT_LANG, normalize_lang

DEMO_JOB_EN = """Senior Backend Developer (m/f/d)

We are looking for an experienced person to join our product team.

Requirements:
- At least 5 years of professional experience in software development
- Excellent knowledge of Python and SQL
- Experience with AWS and Docker
- A completed degree (Bachelor) in Computer Science
- Excellent German and English skills
- Project management and Scrum desirable
"""

DEMO_CVS_EN = [
    (
        "Lena Hoffmann",
        """Name: Lena Hoffmann
Email: lena.hoffmann@example.com
Experience: 7 years as a software developer
Skills: Python, SQL, AWS, Docker, Scrum
Education: Master Computer Science
Languages: German, English
""",
    ),
    (
        "Tomáš Novák",
        """Name: Tomas Novak
Experience: 3 years backend
Skills: Python, JavaScript
Education: Bachelor
Languages: English
""",
    ),
    (
        "Sarah Klein",
        """Name: Sarah Klein
Email: sarah.klein@example.com
Skills: Java, SQL, Kubernetes
Education: Bachelor Business Informatics
Languages: German, English, French
""",
    ),
]

DEMO_JOB_DE = """Senior Backend Entwickler (m/w/d)

Wir suchen eine erfahrene Persönlichkeit für unser Produktteam.

Anforderungen:
- Mindestens 5 Jahre Berufserfahrung in der Softwareentwicklung
- Sehr gute Kenntnisse in Python und SQL
- Erfahrung mit AWS und Docker
- Abgeschlossenes Studium (Bachelor) im Bereich Informatik
- Sehr gute Deutsch- und Englischkenntnisse
- Projektmanagement und Scrum wünschenswert
"""

DEMO_CVS_DE = [
    (
        "Lena Hoffmann",
        """Name: Lena Hoffmann
E-Mail: lena.hoffmann@example.com
Berufserfahrung: 7 Jahre als Softwareentwicklerin
Skills: Python, SQL, AWS, Docker, Scrum
Ausbildung: Master Informatik
Sprachen: Deutsch, Englisch
""",
    ),
    (
        "Tomáš Novák",
        """Name: Tomas Novak
Berufserfahrung: 3 Jahre Backend
Skills: Python, JavaScript
Ausbildung: Bachelor
Sprachen: Englisch
""",
    ),
    (
        "Sarah Klein",
        """Name: Sarah Klein
E-Mail: sarah.klein@example.com
Skills: Java, SQL, Kubernetes
Ausbildung: Bachelor Wirtschaftsinformatik
Sprachen: Deutsch, Englisch, Französisch
""",
    ),
]

_JOBS = {"en": DEMO_JOB_EN, "de": DEMO_JOB_DE}
_CVS = {"en": DEMO_CVS_EN, "de": DEMO_CVS_DE}


def demo_job(lang: str = DEFAULT_LANG) -> str:
    return _JOBS[normalize_lang(lang)]


def demo_cvs(lang: str = DEFAULT_LANG) -> list:
    return _CVS[normalize_lang(lang)]
