import type {
  DataQualityRequest,
  DataQualityResponse,
  ReconcileMedicationRequest,
  ReconcileMedicationResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_APP_API_KEY || "clinical-demo-key";

async function postJson<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
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
