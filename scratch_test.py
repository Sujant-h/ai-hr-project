import os
from dotenv import load_dotenv

load_dotenv()

from llm_agents import clean_markdown, _chat_json, REQUIREMENTS_SCHEMA, STELLENPROFIL_SYSTEM_PROMPT, fence_document, _UNTRUSTED_DOC_NOTICE

text = """
Entdecke als Werkstudent (w/m/d) im Bereich IT-Sicherheit / IT Security das vielseitige Tagesgeschäft und unterstütze Dein Team dabei, die vertraulichen Daten unserer Kund:innen vor IT-Sicherheitsvorfällen aller Art zu schützen. In anspruchsvollen Aufgabenstellungen aus den Bereichen Cyber Security, IT-Forensik, Datenschutz oder Penetration Testing erweiterst und vertiefst Du Dein Fachwissen und bringst Deine Fähigkeiten und Qualitäten gezielt ein. 

Du willst gemeinsam mit uns die Datenwelt sicherer machen? Bewirb Dich jetzt für eine Werkstudierendentätigkeit bei uns und dann kannst Du Dich für 3 - 19,5 Stunden / Woche und in den Semesterferien bis zu 40 Stunden / Woche hier einbringen:

    Du unterstützt unsere IT-Sicherheitsexperten/-expertinnen bei der Analyse und Dokumentation von Angriffen und Angriffsmustern sowie beim Aufspüren und Neutralisieren von Schadsoftware.
    Zusammen mit Deinem Team wirkst Du bei Untersuchungen von IT-Sicherheitsvorfällen mit und beteiligst Dich an der Ergreifung von Erst- und Gegenmaßnahmen (z.B. Incident Response nach Hacking-Angriff).
    In der Digitalen Forensik hilfst Du bei der Daten- und digitalen Spurensicherung, stellst gelöschte Dateien wieder her und trägst zur Identifizierung der Anzeichen für Wirtschaftskriminalität bei.
    Du unterstützt uns bei der Beratung unserer Kund:innen in der Optimierung ihrer Reaktionsfähigkeit auf Sicherheitsvorfälle sowie zu deren Vermeidung und Früherkennung.
    Zudem wirst Du in der Entwicklung und Umsetzung von Sicherheitsstrategien, der Durchführung von Schutzbedarfsanalysen und Risikoassessments sowie dem Aufbau der Sicherheitsorganisation aktiv eingebunden.

Dein Profil:

    Werkstudent (w/m/d) im Bereich IT-Sicherheit / IT Security wirst Du bei uns mit mindestens drei abgeschlossenen Fachsemestern eines Studiums der Informatik, Wirtschaftsinformatik oder Naturwissenschaften mit IT-Bezug.
    Du bringst erste relevante Berufserfahrungen durch vorhergehende Praktika mit.
    Deutsch und Englisch beherrschst Du auf C1-Niveau.
    Du gehst Probleme lösungsorientiert an und bist bereit, Dich neuen Herausforderungen zu stellen.
"""

markdown = clean_markdown(text)
data = _chat_json(
    STELLENPROFIL_SYSTEM_PROMPT,
    (
        "# STELLENANZEIGE (Markdown)\n"
        f"{_UNTRUSTED_DOC_NOTICE}\n\n"
        f"{fence_document(markdown)}\n\n"
        "# TASK\n"
        "Extract the measurable requirements from the advertisement above, "
        "following only the rules from the system prompt: extract what the "
        "text states, never invent, muss/kann only, English or German labels."
    ),
    "requirements_extraction",
    REQUIREMENTS_SCHEMA,
)

import json
print(json.dumps(data, indent=2))
