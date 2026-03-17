from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ...schemas.reviewer import ReviewerActionResponse, ReviewerDecisionRequest, ReviewerNoteRequest
from ...services.audit_service import create_audit_event
from ...services.case_service import get_case, update_case_outputs

router = APIRouter(prefix="/api/cases/{case_id}/reviewer", tags=["reviewer"])


def _apply_reviewer_action(
    case_id: str,
    decision: str,
    title: str,
    payload: ReviewerDecisionRequest,
) -> ReviewerActionResponse:
    try:
        get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc

    reason = (payload.reason or "").strip()
    if decision in {"rejected", "manual_review"} and not reason:
        raise HTTPException(status_code=422, detail="A reviewer rationale is required for this action")

    updated_case = update_case_outputs(
        case_id,
        status="approved" if decision == "approved" else "awaiting_clinician",
        review_decision=decision,
    )
    event_id = create_audit_event(
        case_id,
        "reviewer_action",
        title,
        f"Reviewer marked the case as {decision}. {reason or 'No rationale recorded.'}",
        payload={
            "decision": decision,
            "reason": reason or None,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        },
        actor="reviewer",
        summary=title,
        metadata={"decision": decision, "reason_recorded": bool(reason)},
    )
    return ReviewerActionResponse(
        case_id=case_id,
        status=updated_case.status,
        reviewer_decision=decision,
        audit_event_id=event_id,
        updated_at=updated_case.updated_at,
        reason_recorded=bool(reason),
    )


@router.post("/approve", response_model=ReviewerActionResponse)
def approve_case(case_id: str, payload: ReviewerDecisionRequest) -> ReviewerActionResponse:
    return _apply_reviewer_action(case_id, "approved", "Recommendation approved", payload)


@router.post("/reject", response_model=ReviewerActionResponse)
def reject_case(case_id: str, payload: ReviewerDecisionRequest) -> ReviewerActionResponse:
    return _apply_reviewer_action(case_id, "rejected", "Recommendation rejected", payload)


@router.post("/manual-review", response_model=ReviewerActionResponse)
def request_manual_review(case_id: str, payload: ReviewerDecisionRequest) -> ReviewerActionResponse:
    return _apply_reviewer_action(case_id, "manual_review", "Manual review requested", payload)


@router.post("/note", response_model=ReviewerActionResponse)
def add_reviewer_note(case_id: str, payload: ReviewerNoteRequest) -> ReviewerActionResponse:
    try:
        updated_case = update_case_outputs(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc
    event_id = create_audit_event(
        case_id,
        "reviewer_note",
        "Reviewer note added",
        payload.note,
        payload={"note": payload.note, "recorded_at": datetime.now(timezone.utc).isoformat()},
        actor="reviewer",
        summary="Reviewer note added",
        metadata={"note_length": len(payload.note)},
    )
    return ReviewerActionResponse(
        case_id=case_id,
        status=updated_case.status,
        reviewer_decision=updated_case.review_decision or "not_recorded",
        audit_event_id=event_id,
        updated_at=updated_case.updated_at,
        reason_recorded=True,
    )
