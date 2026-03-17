from typing import Optional

from pydantic import BaseModel


class ReviewerActionResponse(BaseModel):
    case_id: str
    status: str
    reviewer_decision: str
    audit_event_id: str
    updated_at: str
    reason_recorded: bool = False


class ReviewerDecisionRequest(BaseModel):
    reason: Optional[str] = None


class ReviewerNoteRequest(BaseModel):
    note: str
