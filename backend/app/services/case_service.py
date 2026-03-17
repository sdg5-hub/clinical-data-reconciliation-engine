import json
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from ..db.session import dumps_json, get_connection
from ..schemas.case import CaseCreateRequest, CaseDetail, CaseSummary
from .audit_service import create_audit_event


def _row_to_case_detail(row) -> CaseDetail:
    return CaseDetail(
        id=row["id"],
        name=row["name"],
        risk=row["risk"],
        status=row["status"],
        review_decision=row["review_decision"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        reconciliation_request=json.loads(row["reconciliation_request"]),
        quality_request=json.loads(row["quality_request"]),
        reconciliation_result=json.loads(row["reconciliation_result"]) if row["reconciliation_result"] else None,
        quality_result=json.loads(row["quality_result"]) if row["quality_result"] else None,
    )


def create_case(payload: CaseCreateRequest) -> CaseDetail:
    case_id = str(uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO cases (
                id, name, risk, status, reconciliation_request, quality_request,
                reconciliation_result, quality_result, review_decision, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                case_id,
                payload.name,
                payload.risk,
                "draft",
                dumps_json(payload.reconciliation_request.model_dump()),
                dumps_json(payload.quality_request.model_dump()),
                None,
                None,
                None,
                timestamp,
                timestamp,
            ),
        )
    create_audit_event(
        case_id,
        "case_created",
        "Case created",
        f"Created case for {payload.name}.",
        actor="reviewer",
        summary=f"Created case for {payload.name}",
        metadata={"risk": payload.risk},
    )
    return get_case(case_id)


def list_cases() -> list[CaseSummary]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, name, risk, status, review_decision, created_at, updated_at
            FROM cases
            ORDER BY updated_at DESC
            """
        ).fetchall()
    return [CaseSummary(**dict(row)) for row in rows]


def get_case(case_id: str) -> CaseDetail:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    if row is None:
        raise KeyError(case_id)
    return _row_to_case_detail(row)


def update_case_outputs(
    case_id: str,
    *,
    status: Optional[str] = None,
    review_decision: Optional[str] = None,
    reconciliation_result: Optional[dict] = None,
    quality_result: Optional[dict] = None,
) -> CaseDetail:
    case = get_case(case_id)
    timestamp = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE cases
            SET status = ?, review_decision = ?, reconciliation_result = ?, quality_result = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                status or case.status,
                review_decision if review_decision is not None else case.review_decision,
                dumps_json(reconciliation_result) if reconciliation_result is not None else (dumps_json(case.reconciliation_result) if case.reconciliation_result else None),
                dumps_json(quality_result) if quality_result is not None else (dumps_json(case.quality_result) if case.quality_result else None),
                timestamp,
                case_id,
            ),
        )
    return get_case(case_id)
