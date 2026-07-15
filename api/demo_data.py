"""Seed data for the "Demo-Daten laden" flow.

Lives outside app.py so both the Streamlit UI and the API can serve it without
either importing the other.
"""

from __future__ import annotations

DEMO_JOB = """Senior Backend Entwickler (m/w/d)

Wir suchen eine erfahrene Persönlichkeit für unser Produktteam.

Anforderungen:
- Mindestens 5 Jahre Berufserfahrung in der Softwareentwicklung
- Sehr gute Kenntnisse in Python und SQL
- Erfahrung mit AWS und Docker
- Abgeschlossenes Studium (Bachelor) im Bereich Informatik
- Sehr gute Deutsch- und Englischkenntnisse
- Projektmanagement und Scrum wünschenswert
"""

DEMO_CVS = [
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
