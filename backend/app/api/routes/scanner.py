from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ...schemas.scanner import ScannerEventRequest, ScannerEventResponse
from ...services.audit_service import create_audit_event
from ...services.case_service import get_case

router = APIRouter(prefix="/api/cases/{case_id}/scanner-events", tags=["scanner"])


@router.post("", response_model=ScannerEventResponse)
def create_scanner_event(case_id: str, payload: ScannerEventRequest) -> ScannerEventResponse:
    try:
        get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc

    created_at = datetime.now(timezone.utc).isoformat()
    event_id = create_audit_event(
        case_id,
        "scanner_event",
        "Medication scan applied",
        (
            f"{payload.source_type} matched {payload.inferred_medication} "
            f"with {payload.candidate_count} candidate(s)."
        ),
        payload=payload.model_dump(),
        actor="reviewer",
        summary=f"Applied scanner result: {payload.inferred_medication}",
        metadata={
            "source_type": payload.source_type,
            "confidence": payload.confidence,
            "candidate_count": payload.candidate_count,
            **payload.metadata,
        },
    )
    return ScannerEventResponse(
        case_id=case_id,
        audit_event_id=event_id,
        created_at=created_at,
        source_type=payload.source_type,
        inferred_medication=payload.inferred_medication,
    )
