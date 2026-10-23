# syntax=docker/dockerfile:1
# API-Image (FastAPI). Alle Abhängigkeiten haben fertige Wheels, daher keine Build-Tools.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Abhängigkeiten zuerst, damit der Layer gecacht bleibt, solange requirements.txt gleich ist
COPY requirements.txt .
RUN pip install -r requirements.txt

# Nur der Laufzeit-Code, keine Tests, Docs oder Frontend-Quellen
COPY api ./api
COPY agents ./agents
COPY i18n.py llm_agents.py models.py vocabulary.py ./

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200 else 1)"

# Die API ist nur aus dem web-Container erreichbar; dessen X-Forwarded-For (echte Besucher-IP,
# gesetzt vom Host-nginx) wird übernommen, damit das Rate-Limit pro IP greift.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
