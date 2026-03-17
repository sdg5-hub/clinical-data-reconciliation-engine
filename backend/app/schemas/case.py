from typing import Optional

from pydantic import BaseModel

from .data_quality import DataQualityRequest, DataQualityResponse
from .reconciliation import ReconcileMedicationRequest, ReconcileMedicationResponse


class CaseCreateRequest(BaseModel):
    name: str
    risk: str
    reconciliation_request: ReconcileMedicationRequest
    quality_request: DataQualityRequest


class CaseSummary(BaseModel):
    id: str
    name: str
    risk: str
    status: str
    review_decision: Optional[str] = None
    created_at: str
    updated_at: str


class CaseDetail(CaseSummary):
    reconciliation_request: ReconcileMedicationRequest
    quality_request: DataQualityRequest
    reconciliation_result: Optional[ReconcileMedicationResponse] = None
    quality_result: Optional[DataQualityResponse] = None
