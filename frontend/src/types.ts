export type PatientContext = {
  age: number;
  conditions: string[];
  recent_labs?: Record<string, unknown> | null;
};

export type MedicationSource = {
  system: string;
  medication: string;
  last_updated?: string;
  last_filled?: string;
  source_reliability: string;
};

export type ReconcileMedicationRequest = {
  patient_context: PatientContext;
  sources: MedicationSource[];
};

export type ReconcileMedicationResponse = {
  reconciled_medication: string;
  confidence_score: number;
  reasoning: string;
  recommended_actions: string[];
  clinical_safety_check: string;
  selected_source_system: string;
  review_flags: string[];
  source_rankings: {
    system: string;
    medication: string;
    normalized_medication: string;
    score: number;
    rank: number;
    reliability: string;
    freshness_evidence: string;
    review_flags: string[];
  }[];
  confidence_breakdown?: {
    source_reliability: number;
    recency_weighting: number;
    clinical_plausibility: number;
    fill_verification: number;
    conflict_penalty: number;
  } | null;
  reasoning_trace?: {
    label: string;
    detail: string;
  }[];
  conflict_severity?: {
    level: string;
    explanation: string;
  } | null;
  what_changed?: {
    system: string;
    source_medication: string;
    reconciled_medication: string;
    changed: boolean;
    explanation: string;
    category?: string;
  }[];
  rule_hits?: string[];
  recommendation_disposition?: "safe_to_approve" | "requires_review" | "manual_review_recommended";
  evidence_cards?: {
    system: string;
    reliability: number;
    recency: string;
    safety_notes: string[];
    conflict_notes: string[];
  }[];
};

export type ReviewDecision = "approved" | "rejected" | "manual_review" | null;
export type CaseStatus = "Draft" | "Reviewing" | "Awaiting clinician" | "Approved" | "Resolved";

export type DataQualityRequest = {
  demographics: {
    name: string;
    dob: string;
    gender: string;
  };
  medications: string[];
  allergies: string[];
  conditions: string[];
  vital_signs: {
    blood_pressure?: string;
    heart_rate?: number;
  };
  last_updated: string;
};

export type IssueDetected = {
  field: string;
  issue: string;
  severity: string;
  domain: string;
  blocking: boolean;
  remediation: string;
  approval_impact: "blocking" | "advisory";
};

export type DataQualityResponse = {
  overall_score: number;
  breakdown: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    clinical_plausibility: number;
  };
  issues_detected: IssueDetected[];
  summary: string;
  issue_groups?: Record<string, IssueDetected[]>;
  recommended_follow_up?: string[];
  record_freshness?: string | null;
  field_diagnostics?: {
    field: string;
    detail: string;
    category: string;
  }[];
};

export type ReviewerActivity = {
  id: string;
  type: "reconciliation" | "quality" | "review-decision" | "audit" | "scanner" | "fhir";
  title: string;
  detail: string;
  timestamp: string;
  severity: "neutral" | "success" | "warning" | "danger";
};

export type CaseSummary = {
  id: string;
  name: string;
  risk: "high" | "medium" | "low";
  status: string;
  review_decision?: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseDetail = CaseSummary & {
  reconciliation_request: ReconcileMedicationRequest;
  quality_request: DataQualityRequest;
  reconciliation_result?: ReconcileMedicationResponse | null;
  quality_result?: DataQualityResponse | null;
};

export type ReviewerActionResponse = {
  case_id: string;
  status: string;
  reviewer_decision: string;
  audit_event_id: string;
  updated_at: string;
  reason_recorded: boolean;
};

export type AuditEvent = {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  detail: string;
  payload: {
    actor?: "system" | "reviewer";
    event_type?: string;
    summary?: string;
    detail?: string;
    metadata?: Record<string, unknown>;
    data?: Record<string, unknown>;
  } | Record<string, unknown>;
  created_at: string;
};

export type ReviewerDecisionRequest = {
  reason?: string;
};

export type ScannerCandidate = {
  label: string;
  confidence: number;
  reason: string;
};

export type ScanSourceType = "live-camera" | "captured-frame" | "uploaded-image" | "manual-entry" | "ocr-label";

export type ScannerEventRequest = {
  raw_value: string;
  source_type: ScanSourceType;
  inferred_medication: string;
  confidence: number;
  candidate_count: number;
  metadata: Record<string, unknown>;
};

export type ScannerEventResponse = {
  case_id: string;
  audit_event_id: string;
  created_at: string;
  source_type: string;
  inferred_medication: string;
};

export type ScanHistoryItem = {
  id: string;
  rawValue: string;
  codeType: string;
  sourceType: ScanSourceType;
  candidates: ScannerCandidate[];
  appliedMedication: string;
  recordedAt: string;
  confidenceBand: "high" | "medium" | "low";
};

export type FhirSnapshotResponse = {
  case_id: string;
  raw_bundle: Record<string, unknown>;
  normalized_records: Record<string, unknown>;
};

export type PyHealthPatientResponse = {
  patient_id: string;
  gender?: string | null;
  birth_datetime?: string | null;
  available_tables: string[];
  visit_count: number;
  event_count: number;
  visits: {
    visit_id: string;
    encounter_time?: string | null;
    discharge_time?: string | null;
    discharge_status?: string | null;
    event_count: number;
    tables: string[];
  }[];
  events: {
    table: string;
    code: string;
    vocabulary: string;
    visit_id: string;
    patient_id: string;
    timestamp?: string | null;
    attributes: Record<string, unknown>;
  }[];
  source_summary: Record<string, unknown>;
};

export type PatientCase = {
  id: string;
  name: string;
  risk: "high" | "medium" | "low";
  reconciliationRequest: ReconcileMedicationRequest;
  qualityRequest: DataQualityRequest;
  reconciliationResult: ReconcileMedicationResponse | null;
  qualityResult: DataQualityResponse | null;
  reviewDecision: ReviewDecision;
  status: CaseStatus;
  activities: ReviewerActivity[];
};
