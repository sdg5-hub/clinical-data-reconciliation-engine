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
};

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
};
