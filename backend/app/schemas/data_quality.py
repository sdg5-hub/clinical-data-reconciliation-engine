from typing import Optional

from pydantic import BaseModel, Field


class Demographics(BaseModel):
    name: str
    dob: str
    gender: str


class VitalSigns(BaseModel):
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None


class DataQualityRequest(BaseModel):
    demographics: Demographics
    medications: list[str]
    allergies: list[str]
    conditions: list[str]
    vital_signs: VitalSigns
    last_updated: str


class IssueDetected(BaseModel):
    field: str
    issue: str
    severity: str
    domain: str = "accuracy"
    blocking: bool = False
    remediation: str = ""
    approval_impact: str = "advisory"


class DataQualityBreakdown(BaseModel):
    completeness: int
    accuracy: int
    timeliness: int
    clinical_plausibility: int


class FieldDiagnostic(BaseModel):
    field: str
    detail: str
    category: str


class DataQualityResponse(BaseModel):
    overall_score: int
    breakdown: DataQualityBreakdown
    issues_detected: list[IssueDetected]
    summary: str
    issue_groups: dict[str, list[IssueDetected]] = Field(default_factory=dict)
    recommended_follow_up: list[str] = Field(default_factory=list)
    record_freshness: Optional[str] = None
    field_diagnostics: list[FieldDiagnostic] = Field(default_factory=list)
