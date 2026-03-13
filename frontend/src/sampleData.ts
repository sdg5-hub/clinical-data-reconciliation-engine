import type { DataQualityRequest, ReconcileMedicationRequest } from "./types";

export const sampleMedicationRequest: ReconcileMedicationRequest = {
  patient_context: {
    age: 67,
    conditions: ["Type 2 diabetes", "Hypertension", "Chronic kidney disease"],
    recent_labs: {
      a1c: "7.4%",
      creatinine: 1.6,
    },
  },
  sources: [
    {
      system: "Epic EHR",
      medication: "Metformin 1000mg BID",
      last_updated: "2026-03-10",
      source_reliability: "high",
    },
    {
      system: "Retail pharmacy",
      medication: "Metformin 500mg BID",
      last_filled: "2026-03-08",
      source_reliability: "medium",
    },
    {
      system: "Care management note",
      medication: "Metformin held pending renal review",
      last_updated: "2026-02-15",
      source_reliability: "low",
    },
  ],
};

export const sampleQualityRequest: DataQualityRequest = {
  demographics: {
    name: "Jane Doe",
    dob: "1980-01-01",
    gender: "F",
  },
  medications: ["Lisinopril", "Metformin", "Atorvastatin"],
  allergies: [],
  conditions: ["Hypertension", "Type 2 diabetes"],
  vital_signs: {
    blood_pressure: "350/200",
    heart_rate: 88,
  },
  last_updated: "2025-01-01",
};
