from fastapi import APIRouter, HTTPException

from ...schemas.reconciliation import ReconcileMedicationResponse
from ...services.audit_service import create_audit_event
from ...services.case_service import get_case, update_case_outputs
from ...services.reconciliation_engine import run_reconciliation

router = APIRouter(prefix="/api/cases/{case_id}/reconciliation", tags=["reconciliation"])


@router.post("/run", response_model=ReconcileMedicationResponse)
def run_reconciliation_endpoint(case_id: str) -> ReconcileMedicationResponse:
    try:
        case = get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc

    result = run_reconciliation(case.reconciliation_request)
    update_case_outputs(
        case_id,
        status="review_in_progress",
        reconciliation_result=result.model_dump(),
    )
    create_audit_event(
        case_id,
        "reconciliation_run",
        "Reconciliation completed",
        f"Generated recommendation {result.reconciled_medication}.",
        payload=result.model_dump(),
        actor="system",
        summary=f"Reconciliation selected {result.reconciled_medication}",
        metadata={
            "confidence_score": result.confidence_score,
            "disposition": result.recommendation_disposition,
        },
    )
    return result


@router.get("/latest", response_model=ReconcileMedicationResponse)
def latest_reconciliation_endpoint(case_id: str) -> ReconcileMedicationResponse:
    try:
        case = get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc
    if not case.reconciliation_result:
        raise HTTPException(status_code=404, detail="No reconciliation run found")
    return case.reconciliation_result
