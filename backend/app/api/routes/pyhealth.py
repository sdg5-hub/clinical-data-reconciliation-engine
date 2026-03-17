from fastapi import APIRouter, HTTPException

from ...schemas.pyhealth import PyHealthEventResponse, PyHealthPatientResponse
from ...services.case_service import get_case
from ...services.pyhealth_adapter import build_pyhealth_patient

router = APIRouter(prefix="/api/cases/{case_id}/pyhealth", tags=["pyhealth"])


@router.get("/patient", response_model=PyHealthPatientResponse)
def get_pyhealth_patient(case_id: str) -> PyHealthPatientResponse:
    try:
        case = get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc
    return build_pyhealth_patient(case)


@router.get("/events", response_model=list[PyHealthEventResponse])
def get_pyhealth_events(case_id: str) -> list[PyHealthEventResponse]:
    patient = get_pyhealth_patient(case_id)
    return patient.events
