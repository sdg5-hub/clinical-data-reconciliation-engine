from fastapi import APIRouter, HTTPException

from ...schemas.case import CaseCreateRequest, CaseDetail, CaseSummary
from ...services.audit_service import list_audit_events
from ...services.case_service import create_case, get_case, list_cases

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.post("", response_model=CaseDetail)
def create_case_endpoint(payload: CaseCreateRequest) -> CaseDetail:
    return create_case(payload)


@router.get("", response_model=list[CaseSummary])
def list_cases_endpoint() -> list[CaseSummary]:
    return list_cases()


@router.get("/{case_id}", response_model=CaseDetail)
def get_case_endpoint(case_id: str) -> CaseDetail:
    try:
        return get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc


@router.get("/{case_id}/audit", response_model=list[dict])
def get_case_audit(case_id: str) -> list[dict]:
    try:
        get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc
    return list_audit_events(case_id)
