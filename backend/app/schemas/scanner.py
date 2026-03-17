from typing import Any

from pydantic import BaseModel, Field


class ScannerEventRequest(BaseModel):
    raw_value: str
    source_type: str
    inferred_medication: str
    confidence: float
    candidate_count: int
    metadata: dict[str, Any] = Field(default_factory=dict)


class ScannerEventResponse(BaseModel):
    case_id: str
    audit_event_id: str
    created_at: str
    source_type: str
    inferred_medication: str
