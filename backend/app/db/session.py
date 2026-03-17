import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from ..core.config import get_settings


def _database_path() -> Path:
    raw_path = Path(get_settings().database_path)
    if raw_path.is_absolute():
        return raw_path
    return Path(__file__).resolve().parents[3] / raw_path


def init_db() -> None:
    path = _database_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS cases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                risk TEXT NOT NULL,
                status TEXT NOT NULL,
                reconciliation_request TEXT NOT NULL,
                quality_request TEXT NOT NULL,
                reconciliation_result TEXT,
                quality_result TEXT,
                review_decision TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_events (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                title TEXT NOT NULL,
                detail TEXT NOT NULL,
                payload TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(case_id) REFERENCES cases(id)
            );

            CREATE TABLE IF NOT EXISTS fhir_snapshots (
                id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                raw_bundle TEXT NOT NULL,
                normalized_records TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(case_id) REFERENCES cases(id)
            );
            """
        )
        case_count = connection.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
        if case_count == 0:
            seeded_request = {
                "patient_context": {
                    "age": 67,
                    "conditions": ["Type 2 diabetes", "Hypertension", "Chronic kidney disease"],
                    "recent_labs": {"egfr": 45, "creatinine": 1.6},
                },
                "sources": [
                    {
                        "system": "Hospital EHR",
                        "medication": "Metformin 1000mg BID",
                        "last_updated": "2026-03-10",
                        "source_reliability": "high",
                    },
                    {
                        "system": "Primary care",
                        "medication": "Metformin 500mg BID",
                        "last_updated": "2026-03-12",
                        "source_reliability": "high",
                    },
                    {
                        "system": "Retail pharmacy",
                        "medication": "Metformin 1000mg daily",
                        "last_filled": "2026-03-08",
                        "source_reliability": "medium",
                    },
                ],
            }
            seeded_quality = {
                "demographics": {"name": "Jane Doe", "dob": "1980-01-01", "gender": "F"},
                "medications": ["Metformin", "Lisinopril", "Atorvastatin"],
                "allergies": [],
                "conditions": ["Hypertension", "Type 2 diabetes", "Chronic kidney disease"],
                "vital_signs": {"blood_pressure": "350/200", "heart_rate": 88},
                "last_updated": "2025-01-01",
            }
            connection.execute(
                """
                INSERT INTO cases (
                    id, name, risk, status, reconciliation_request, quality_request,
                    reconciliation_result, quality_result, review_decision, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "seeded-jane-doe",
                    "Jane Doe",
                    "high",
                    "draft",
                    dumps_json(seeded_request),
                    dumps_json(seeded_quality),
                    None,
                    None,
                    None,
                    "2026-03-13T12:00:00+00:00",
                    "2026-03-13T12:00:00+00:00",
                ),
            )


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    path = _database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def _json_ready(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return _json_ready(value.model_dump())
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    return value


def dumps_json(value: object) -> str:
    return json.dumps(_json_ready(value), sort_keys=True)
