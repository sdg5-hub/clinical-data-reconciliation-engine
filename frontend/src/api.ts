import type {
  AuditEvent,
  CaseDetail,
  CaseSummary,
  DataQualityRequest,
  DataQualityResponse,
  FhirSnapshotResponse,
  PyHealthPatientResponse,
  ReconcileMedicationRequest,
  ReconcileMedicationResponse,
  ReviewerDecisionRequest,
  ReviewerActionResponse,
  ScannerEventRequest,
  ScannerEventResponse,
} from "./types";

const API_BASE = import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL || "";
const API_KEY = import.meta.env.VITE_APP_API_KEY || "clinical-demo-key";

async function postJson<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Cannot reach backend API. Confirm the FastAPI server is running on port 8000.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("API authentication failed. Check that the frontend and backend API keys match.");
    }
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "X-API-Key": API_KEY,
      },
    });
  } catch {
    throw new Error("Cannot reach backend API. Confirm the FastAPI server is running on port 8000.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("API authentication failed. Check that the frontend and backend API keys match.");
    }
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export function reconcileMedication(payload: ReconcileMedicationRequest) {
  return postJson<ReconcileMedicationResponse>("/api/reconcile/medication", payload);
}

export function validateDataQuality(payload: DataQualityRequest) {
  return postJson<DataQualityResponse>("/api/validate/data-quality", payload);
}

export function fetchCases() {
  return getJson<CaseSummary[]>("/api/cases");
}

export function fetchCase(caseId: string) {
  return getJson<CaseDetail>(`/api/cases/${caseId}`);
}

export function createCase(payload: {
  name: string;
  risk: "high" | "medium" | "low";
  reconciliation_request: ReconcileMedicationRequest;
  quality_request: DataQualityRequest;
}) {
  return postJson<CaseDetail>("/api/cases", payload);
}

export function runCaseReconciliation(caseId: string) {
  return postJson<ReconcileMedicationResponse>(`/api/cases/${caseId}/reconciliation/run`, {});
}

export function runCaseDataQuality(caseId: string) {
  return postJson<DataQualityResponse>(`/api/cases/${caseId}/data-quality/run`, {});
}

export function approveCase(caseId: string, payload: ReviewerDecisionRequest = {}) {
  return postJson<ReviewerActionResponse>(`/api/cases/${caseId}/reviewer/approve`, payload);
}

export function rejectCase(caseId: string, payload: ReviewerDecisionRequest) {
  return postJson<ReviewerActionResponse>(`/api/cases/${caseId}/reviewer/reject`, payload);
}

export function requestManualReview(caseId: string, payload: ReviewerDecisionRequest) {
  return postJson<ReviewerActionResponse>(`/api/cases/${caseId}/reviewer/manual-review`, payload);
}

export function fetchAudit(caseId: string) {
  return getJson<AuditEvent[]>(`/api/cases/${caseId}/audit`);
}

export function createScannerEvent(caseId: string, payload: ScannerEventRequest) {
  return postJson<ScannerEventResponse>(`/api/cases/${caseId}/scanner-events`, payload);
}

export function ingestFhirBundle(caseId: string, bundle: Record<string, unknown>) {
  return postJson<FhirSnapshotResponse>(`/api/cases/${caseId}/ingest-fhir`, { bundle });
}

export function fetchNormalizedFhir(caseId: string) {
  return getJson<Record<string, unknown>>(`/api/cases/${caseId}/fhir/normalized-records`);
}

export function fetchFhirSnapshot(caseId: string) {
  return getJson<FhirSnapshotResponse>(`/api/cases/${caseId}/fhir/source-records`);
}

export function fetchPyHealthPatient(caseId: string) {
  return getJson<PyHealthPatientResponse>(`/api/cases/${caseId}/pyhealth/patient`);
}
