from typing import Any, Optional

from pydantic import BaseModel, Field


class PatientContext(BaseModel):
    age: int
    conditions: list[str]
    recent_labs: Optional[dict[str, Any]] = None


class MedicationSource(BaseModel):
    system: str
    medication: str
    last_updated: Optional[str] = None
    last_filled: Optional[str] = None
    source_reliability: str


class ConfidenceBreakdown(BaseModel):
    source_reliability: float
    recency_weighting: float
    clinical_plausibility: float
    fill_verification: float
    conflict_penalty: float


class ReasoningTraceStep(BaseModel):
    label: str
    detail: str


class ConflictSeverity(BaseModel):
    level: str
    explanation: str


class MedicationSourceRanking(BaseModel):
    system: str
    medication: str
    normalized_medication: str
    score: int
    rank: int
    reliability: str
    freshness_evidence: str
    review_flags: list[str]


class MedicationChange(BaseModel):
    system: str
    source_medication: str
    reconciled_medication: str
    changed: bool
    explanation: str
    category: str = "source_mismatch"


class EvidenceCard(BaseModel):
    system: str
    reliability: float
    recency: str
    safety_notes: list[str] = Field(default_factory=list)
    conflict_notes: list[str] = Field(default_factory=list)


class ReconcileMedicationRequest(BaseModel):
    patient_context: PatientContext
    sources: list[MedicationSource]


class ReconcileMedicationResponse(BaseModel):
    reconciled_medication: str
    confidence_score: float
    reasoning: str
    recommended_actions: list[str]
    clinical_safety_check: str
    selected_source_system: str
    review_flags: list[str]
    source_rankings: list[MedicationSourceRanking]
    confidence_breakdown: Optional[ConfidenceBreakdown] = None
    reasoning_trace: list[ReasoningTraceStep] = Field(default_factory=list)
    conflict_severity: Optional[ConflictSeverity] = None
    what_changed: list[MedicationChange] = Field(default_factory=list)
    rule_hits: list[str] = Field(default_factory=list)
    recommendation_disposition: str = "requires_review"
    evidence_cards: list[EvidenceCard] = Field(default_factory=list)
