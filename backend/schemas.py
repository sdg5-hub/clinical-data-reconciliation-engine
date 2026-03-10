from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class PatientContext(BaseModel):
    age: int
    conditions: List[str]
    recent_labs: Optional[Dict[str, Any]] = None


class MedicationSource(BaseModel):
    system: str
    medication: str
    last_updated: Optional[str] = None
    last_filled: Optional[str] = None
    source_reliability: str


class ReconcileMedicationRequest(BaseModel):
    patient_context: PatientContext
    sources: List[MedicationSource]


class ReconcileMedicationResponse(BaseModel):
    reconciled_medication: str
    confidence_score: float
    reasoning: str
    recommended_actions: List[str]
    clinical_safety_check: str


class Demographics(BaseModel):
    name: str
    dob: str
    gender: str


class VitalSigns(BaseModel):
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None


class DataQualityRequest(BaseModel):
    demographics: Demographics
    medications: List[str]
    allergies: List[str]
    conditions: List[str]
    vital_signs: VitalSigns
    last_updated: str


class IssueDetected(BaseModel):
    field: str
    issue: str
    severity: str


class DataQualityBreakdown(BaseModel):
    completeness: int
    accuracy: int
    timeliness: int
    clinical_plausibility: int


class DataQualityResponse(BaseModel):
    overall_score: int
    breakdown: DataQualityBreakdown
    issues_detected: List[IssueDetected]
