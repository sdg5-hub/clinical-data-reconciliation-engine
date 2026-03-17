from fastapi import APIRouter, HTTPException

from ...schemas.data_quality import DataQualityResponse
from ...services.audit_service import create_audit_event
from ...services.case_service import get_case, update_case_outputs
from ...services.data_quality_engine import run_data_quality

router = APIRouter(prefix="/api/cases/{case_id}/data-quality", tags=["data-quality"])


@router.post("/run", response_model=DataQualityResponse)
def run_data_quality_endpoint(case_id: str) -> DataQualityResponse:
    try:
        case = get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc

    result = run_data_quality(case.quality_request)
    update_case_outputs(
        case_id,
        status="review_in_progress",
        quality_result=result.model_dump(),
    )
    create_audit_event(
        case_id,
        "data_quality_run",
        "Data quality assessment completed",
        f"Generated quality score {result.overall_score}/100.",
        payload=result.model_dump(),
        actor="system",
        summary=f"Data quality scored {result.overall_score}/100",
        metadata={
            "overall_score": result.overall_score,
            "issue_count": len(result.issues_detected),
        },
    )
    return result


@router.get("/latest", response_model=DataQualityResponse)
def latest_data_quality_endpoint(case_id: str) -> DataQualityResponse:
    try:
        case = get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc
    if not case.quality_result:
        raise HTTPException(status_code=404, detail="No data-quality assessment found")
    return case.quality_result
