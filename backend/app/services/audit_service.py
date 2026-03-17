import json
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from ..db.session import dumps_json, get_connection


def create_audit_event(
    case_id: str,
    event_type: str,
    title: str,
    detail: str,
    payload: Optional[dict] = None,
    *,
    actor: str = "system",
    summary: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> str:
    event_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    normalized_payload = {
        "actor": actor,
        "event_type": event_type,
        "summary": summary or title,
        "detail": detail,
        "metadata": metadata or {},
    }
    if payload:
        normalized_payload["data"] = payload
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO audit_events (id, case_id, event_type, title, detail, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                case_id,
                event_type,
                title,
                detail,
                dumps_json(normalized_payload),
                created_at,
            ),
        )
    return event_id


def list_audit_events(case_id: str) -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, case_id, event_type, title, detail, payload, created_at
            FROM audit_events
            WHERE case_id = ?
            ORDER BY created_at DESC
            """,
            (case_id,),
        ).fetchall()
    events = []
    for row in rows:
        event = dict(row)
        payload = event.get("payload")
        if payload:
            try:
                event["payload"] = json.loads(payload)
            except json.JSONDecodeError:
                event["payload"] = payload
        else:
            event["payload"] = {}
        events.append(event)
    return events
