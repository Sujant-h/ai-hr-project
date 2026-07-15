"""Dump the OpenAPI schema to openapi.json.

web/src/api/types.ts is generated from this file, so the TypeScript types cannot
drift from the Python ones. Re-run this whenever a schema changes.
"""

from __future__ import annotations

import json
from pathlib import Path

from api.main import app

target = Path(__file__).parent.parent / "openapi.json"
target.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False), encoding="utf-8")
print(f"wrote {target}")
