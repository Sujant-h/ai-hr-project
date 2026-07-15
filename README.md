# Recruiting AI — Multi-Agent HR Demo

A premium, SaaS-style **Streamlit** web app that demonstrates a compliant,
multi-agent recruiting workflow. Recruiters paste a job description, upload or
paste candidate CVs, and the app extracts structured requirements, matches each
candidate against them, surfaces information gaps, and drafts follow-up
questions — **all without ever ranking, scoring, or recommending a hire.**

The whole product is designed around a **human-in-the-loop** principle and
European compliance (EU AI Act, GDPR/BDSG, and the German AGG anti-discrimination
law). The agents only *extract* and *compare* information; every hiring decision
stays with a human recruiter. The user interface is in **German**.

---

## What the website does

The app walks a recruiter through a six-step screening workspace, each backed by
a small "agent" (a pure function that takes input and returns structured data):

| Step | Tab | Agent | What it does |
|------|-----|-------|--------------|
| ① | **Stellenprofil** | `stellenprofil_agent` | Extracts measurable requirements (skills, years of experience, education, languages) from a job ad and tags each as `muss` (mandatory) or `kann` (nice-to-have). |
| ② | **Bewerbungen** | `cv_agent` | Parses candidate CVs (pasted text or uploaded PDF) into a structured `Candidate` (name, email, skills, experience, education, languages). |
| ③ | **Kandidaten** | `matching_agent` | Compares each candidate against every requirement and assigns a status: `erfuellt` (met), `teilweise` (partial), `offen` (not mentioned), or `nicht_erfuellt` (contradicted) — **no scores, no ranking.** |
| ④ | **Informationslücken** | `informationsluecken_agent` | Lists the gaps where the CV does not clearly answer a requirement. |
| ⑤ | **Rückfragen** | `rueckfragen_agent` + `generate_email` | Generates neutral follow-up questions and drafts a candidate email. |
| ⑥ | **Audit Log** | — | A timestamped trail of every agent action, for transparency and traceability. |

There is also an immersive landing/intro page, a home page, and a per-candidate
detail view. A **"Demo-Daten laden"** button loads a sample job profile plus
three sample applications so you can try the whole flow instantly.

### Two interchangeable backends

The agents come in two implementations that return the **exact same data
structures** (defined in `models.py`), so the UI never changes:

1. **Rule-based (default).** Deterministic keyword/vocabulary matching in
   `app.py`. Requires **no API key** and runs fully offline — ideal for demos.
2. **LLM-based (optional).** OpenAI-powered extraction and semantic matching in
   `llm_agents.py`. Activated automatically when an `OPENAI_API_KEY` is set.

If the LLM backend is unavailable (no key, package missing, or an API error),
the app **transparently falls back** to the rule-based agents.

### Built-in compliance guardrails

- **Human-in-the-loop:** the agents never rank, score, or recommend. The LLM
  schemas literally have no field for a score.
- **Anti-bias / data minimization:** demographic lines (birth date, gender,
  nationality, religion, marital status, …) are **redacted in Python before**
  anything is sent to the API, *and* the prompts instruct the model to ignore
  any demographic signal — defense in depth. The regex layer is best-effort and
  has known gaps — see
  [Known limits of the regex redaction](#️-known-limits-of-the-regex-redaction-verified-by-testing).
- **Explainability:** every match result must cite *where* in the CV the
  evidence was found, so a human can verify it in seconds.

---

## Where the LLM API is used — exactly

This section documents every place candidate or job data leaves the machine.

### The single network call site

**All** OpenAI traffic funnels through one function: `_chat_json()`
(`llm_agents.py:269`), which makes the only network call in the codebase at
`llm_agents.py:273`:

```python
response = _get_client().chat.completions.create(
    model=DEFAULT_MODEL,          # env OPENAI_MODEL, default "gpt-4o-mini"
    temperature=0,                # reproducible extraction, for the audit trail
    response_format={             # OpenAI Structured Outputs, strict mode
        "type": "json_schema",
        "json_schema": {"name": schema_name, "strict": True, "schema": schema},
    },
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt},
    ],
)
```

Every call is **stateless and single-turn**: exactly one system message + one
user message. No conversation history, no memory, no chaining between
candidates. `temperature=0` keeps extraction reproducible. The client is
configured with `timeout=30, max_retries=2` (`llm_agents.py:101`) so a stalled
request can't freeze the Streamlit worker.

### The three call sites

Only **3 of the 6 agents** ever call the API:

| # | Agent | Function | Schema | System prompt |
|---|-------|----------|--------|----------------|
| ① | Stellenprofil | `stellenprofil_agent_llm()` `:458` | `REQUIREMENTS_SCHEMA` | `STELLENPROFIL_SYSTEM_PROMPT` `:308` |
| ② | CV | `cv_agent_llm()` `:500` | `CANDIDATE_SCHEMA` | `CV_SYSTEM_PROMPT` `:352` |
| ③ | Matching | `matching_agent_llm()` `:568` | `MATCHING_SCHEMA` | `MATCHING_SYSTEM_PROMPT` `:402` |

Each is reached from `app.py` via a guarded wrapper (`analyze_job_profile`,
`analyze_cv`, `match_candidate` — `app.py:308-332`) that checks
`llm_available()` first and catches `LLMError` to fall back to the rule-based
agent, logging the failure to the audit trail.

The prompts are written in **English** (models follow English instructions most
reliably) but every user-facing output field is **required to be German**. Each
prompt follows the same shape: `ROLE → TASK → INPUT → RULES → FEW-SHOT → OUTPUT`.

---

#### ① Stellenprofil-Agent — job ad → requirements

**System prompt** (`llm_agents.py:308`) — key content:
> **ROLE:** "You are a data-extraction engine inside a German HR screening tool.
> You are NOT a recruiter and you make NO judgements."
> **TASK:** extract every measurable requirement (`skill`, `experience`,
> `language`, `education`), classify each as `muss` / `kann`.
> **RULES:** (1) extract only what the text states, never invent; (2) no rating,
> weighting, ranking or scoring beyond muss/kann; (3) **ignore all demographic
> constraints** — boilerplate like "(m/w/d)" is NOT a requirement; (4) canonical
> German names; (5) all labels in German.
> Plus a **few-shot example** mapping a sample German job ad to exact JSON.

**Data sent (user message):**
```
# STELLENANZEIGE (Markdown)

{clean_markdown(job_text)}
```

**Returned:** `{"requirements": [{label, kind, value, importance}]}` — strictly
schema-bound. Note there is **no ID field**: IDs are assigned locally
(`req_{i}_{kind}`), and `value` is defensively coerced to `int` in Python for
`experience`/`education` (`llm_agents.py:475-486`).

> ⚠️ The job ad is **not** demographic-redacted — only `clean_markdown()` runs.
> This is deliberate (a job ad is public text, not personal data), and the
> prompt instructs the model to ignore demographic constraints. But if you paste
> internal notes containing personal data into the job field, **it is sent as-is**.

---

#### ② CV-Agent — CV → structured candidate

**System prompt** (`llm_agents.py:352`) — key content:
> **ROLE:** data-extraction engine that must comply with the EU AI Act,
> GDPR/BDSG and the German AGG. "You are NOT a recruiter and you make NO
> judgements."
> **RULE 1 — DATA MINIMIZATION / ANTI-BIAS:** "You MUST completely ignore and
> NEVER output any demographic or special-category data: age, date/place of
> birth, gender, ethnicity, nationality, religion, marital status, children,
> disabilities, photos or physical descriptions. If such data appears in the CV,
> treat it as if it did not exist."
> **RULES 2-5:** extract only what's stated (unknown → `null` / `"unbekannt"`);
> no evaluating, rating or summarizing the candidate; canonical skill spelling;
> `years_experience` only if explicitly stated or directly computable.
> The **few-shot example** deliberately feeds in a birth date and marital status
> and shows them absent from the output.

**Data sent (user message):**
```
# LEBENSLAUF (Markdown)

{redact_demographics(clean_markdown(cv_text))}
```

**Returned:** `{name, email, skills[], years_experience, education_level,
languages[]}`. There is **no score, rating, or summary field in the schema** —
the model structurally cannot return one.

---

#### ③ Matching-Agent — RAG-style comparison

**System prompt** (`llm_agents.py:402`) — key content:
> **ROLE:** "You are a semantic comparison engine … You compare texts — you do
> NOT evaluate people. A human recruiter makes every decision."
> **TASK:** per requirement, assign exactly one status: `erfuellt` (clear
> evidence, incl. semantic equivalents — PostgreSQL satisfies SQL), `teilweise`
> (partial), `offen` (not mentioned), `nicht_erfuellt` (explicitly contradicted).
> **RULES:** (1) **no ranking, no scoring, no percentages, no hire/reject
> recommendation**; (2) **explainability** — every note must state in German
> *where* the evidence was found ("Im Lebenslauf unter 'Projekte' genannt");
> (3) judge only against the CV text, no world knowledge about the person
> (semantic knowledge about *technologies* is allowed); (4) demographic data must
> never influence a status; (5) when in doubt, choose `teilweise` and explain.

**Data sent (user message)** — assembled by `_build_matching_context()` `:538`:
```
# JOB REQUIREMENTS (JSON)
[{id, label, kind, value, importance}, ...]

# CANDIDATE CV (Markdown)
{candidate.raw_text}          ← the ALREADY-REDACTED markdown from step ②

# TASK
Compare the CV against EVERY requirement id listed above and return one
result per id.
```

This is the "R" in RAG: exactly the two documents needed, nothing else.

**Returned:** `{"results": [{requirement_id, status, note}]}` — the model
supplies **only** `status` and `note`. `label`, `kind` and `importance` are
taken from *our* `Requirement` objects when building the `MatchResult`
(`llm_agents.py:591-607`), so the model **cannot silently rewrite a requirement
or its importance**. Our requirement list is authoritative: any id the model
skips or invents is reconciled locally and defaults to
`offen` / *"bitte manuell prüfen"*.

---

### What is deliberately left out

**Agents that never call the API.** Steps ④, ⑤ and ⑥ have **no LLM
implementation at all** — they are pure local functions in `app.py`:

- ④ `informationsluecken_agent()` `app.py:337` — gap detection
- ⑤ `rueckfragen_agent()` `app.py:354` — follow-up questions (fixed templates)
- ⑤ `generate_email()` `app.py:382` — email draft
- ⑥ the audit log

So **follow-up questions and candidate emails are never sent to OpenAI**, and no
gap analysis leaves the machine.

**Stripped before the API call** (in this order, `llm_agents.py:109-163`):

| Removed | Where | Mechanism |
|---------|-------|-----------|
| The **PDF binary itself** | `pdf_to_markdown()` `:109` | Only extracted Markdown is sent — never the file, never `source`/filename |
| **Embedded images / CV photos** | `clean_markdown()` `:139` | `![alt](src)` Markdown images stripped |
| **Control characters** | `clean_markdown()` `:138` | `\x00-\x1f` removed |
| **Anything past 24,000 chars** | `MAX_INPUT_CHARS` `:81` | Hard truncation (~6k tokens) — context-window guard |
| **Demographic lines** | `redact_demographics()` `:160` | Replaced with `[aus Datenschutzgründen entfernt]` |

**Never sent as structured fields:** `Candidate.id`, `source` (the filename),
and the extracted `skills` / `years` / `education` / `languages` are **not**
re-sent to the matching call — only `raw_text` is. Note, however, that
`raw_text` is the CV text, so **name and email are present in it** (and `email`
is an explicit output field of the CV schema). Contact data is *not* redacted —
only demographic data is.

**Which demographic lines are caught.** `_DEMOGRAPHIC_LINE` (`llm_agents.py:148`)
matches, case-insensitively, lines containing: `geburtsdatum`, `geburtstag`,
`geboren am`, `geburtsort`, `familienstand`, `verheiratet`, `ledig`, `kinder:`,
`staatsangehörigkeit`, `nationalität`, `konfession`, `religion`,
`date of birth`, `born on`, `marital status`, `nationality`, `geschlecht`,
`gender`.

> #### ⚠️ Known limits of the regex redaction (verified by testing)
>
> The redaction is layer 1 of a **defense-in-depth** design — the prompt's
> anti-bias rule is layer 2, and it is doing real work, because the regex is
> leaky. Empirically, these lines **pass through unredacted**:
>
> | Input line | Redacted? | Why |
> |---|---|---|
> | `Geburtsdatum: 12.03.1990` | ✅ yes | — |
> | `Geschlecht: weiblich` | ✅ yes | — |
> | `Alter: 34` / `Age: 34` / `34 Jahre alt` | ❌ **no** | **`alter`/`age` are not in the pattern at all** — age is only caught indirectly via birth date |
> | `Max Mustermann, geb. 12.03.1990` | ❌ **no** | the abbreviation `geb.` is not matched (only `geboren am` / `geburtsdatum`) |
> | `Kinder: 2` | ❌ **no** | the trailing `\b` fails before a space (`Kinder:2` *is* redacted) |
> | `Profil: … mit 10 Jahren Erfahrung, geboren am 1.1.1990` | ❌ **no** | the `^.{0,40}?` prefix cap means the keyword must appear within the **first ~40 characters** of the line |
> | `Foto siehe Anhang` | ❌ **no** | text references to photos aren't matched (embedded images *are* stripped) |
>
> In short: the regex reliably catches **labelled, line-leading** demographic
> fields — the common CV layout — but not free-prose or abbreviated mentions.
> Anything it misses is caught only by the model following the prompt, which is
> not a guarantee. Treat the code-level guardrail as best-effort minimization,
> not a compliance certificate.

### Opting out entirely

Unset `OPENAI_API_KEY` (or uninstall `openai`). `llm_available()`
(`llm_agents.py:90`) then returns `False`, all three wrappers take the
rule-based path, and **no data leaves the machine at all**. The active backend
is shown in the UI and recorded in the audit log for every action.

---

## Project structure

```
ai-hr-project/
├── app.py            # Streamlit UI + rule-based agents + all layout/CSS
├── llm_agents.py     # Optional OpenAI backend (same dataclasses as app.py)
├── models.py         # Shared dataclasses — the contract between backends & UI
└── requirements.txt  # Python dependencies
```

---

## Requirements

- **Python 3.9+**
- Dependencies (from `requirements.txt`):
  - `streamlit>=1.32` — the web framework
  - `pypdf>=4.0` — PDF text extraction (fallback)
  - `openai>=1.40` — optional LLM backend
  - `pymupdf4llm>=0.0.17` — high-quality PDF → Markdown for the LLM backend

---

## How to run it

### 1. Install dependencies

```bash
# From the project directory
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. (Optional) Enable the LLM backend

Skip this to run in the default, no-API-key, rule-based mode.

```bash
export OPENAI_API_KEY="sk-..."          # Windows PowerShell: $env:OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4o-mini"       # optional; this is the default
```

### 3. Launch the app

```bash
streamlit run app.py
```

Streamlit will print a local URL (typically **http://localhost:8501**) and open
it in your browser.

### 4. Try it out

- Click **"✨ Demo-Daten laden"** to load a sample job and three candidates, or
- Paste your own job description in **① Stellenprofil**, add CVs in
  **② Bewerbungen**, then review the results in the following tabs.

The header shows which backend is active (rule-based vs. LLM).

---

## Notes

- The UI language is German; the LLM system prompts are written in English (for
  model reliability) but all user-facing output is in German.
- No candidate data is persisted — everything lives in the Streamlit session and
  is cleared when you reload or restart.
- This is a **demonstration** of a compliant workflow, not a production ATS.
