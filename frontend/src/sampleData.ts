import type { DataQualityRequest, PatientCase, ReconcileMedicationRequest } from "./types";

export const sampleMedicationRequest: ReconcileMedicationRequest = {
  patient_context: {
    age: 67,
    conditions: ["Type 2 diabetes", "Hypertension", "Chronic kidney disease"],
    recent_labs: {
      a1c: "7.4%",
      creatinine: 1.6,
      egfr: 45,
    },
  },
  sources: [
    {
      system: "Hospital EHR",
      medication: "Metformin 1000mg BID",
      last_updated: "2026-03-10",
      source_reliability: "high",
    },
    {
      system: "Primary care",
      medication: "Metformin 500mg BID",
      last_updated: "2026-03-12",
      source_reliability: "high",
    },
    {
      system: "Retail pharmacy",
      medication: "Metformin 1000mg daily",
      last_filled: "2026-03-08",
      source_reliability: "medium",
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
  conditions: ["Hypertension", "Type 2 diabetes", "Chronic kidney disease"],
  vital_signs: {
    blood_pressure: "350/200",
    heart_rate: 88,
  },
  last_updated: "2025-01-01",
};

export const demoTwoMedicationRequest: ReconcileMedicationRequest = {
  patient_context: {
    age: 58,
    conditions: ["Atrial fibrillation", "Hypertension"],
    recent_labs: {
      inr: 2.3,
    },
  },
  sources: [
    {
      system: "Hospital EHR",
      medication: "Warfarin 5mg nightly",
      last_updated: "2026-03-05",
      source_reliability: "high",
    },
    {
      system: "Primary care",
      medication: "Warfarin 2.5mg nightly",
      last_updated: "2026-03-11",
      source_reliability: "high",
    },
    {
      system: "Patient portal",
      medication: "Warfarin 5mg nightly",
      last_updated: "2026-03-09",
      source_reliability: "low",
    },
  ],
};

export const demoTwoQualityRequest: DataQualityRequest = {
  demographics: {
    name: "John Smith",
    dob: "1968-05-19",
    gender: "M",
  },
  medications: ["Warfarin", "Metoprolol"],
  allergies: ["Shellfish"],
  conditions: ["Atrial fibrillation", "Hypertension"],
  vital_signs: {
    blood_pressure: "138/86",
    heart_rate: 92,
  },
  last_updated: "2026-03-09",
};

function buildCase(
  id: string,
  name: string,
  risk: "high" | "medium" | "low",
  reconciliationRequest: ReconcileMedicationRequest,
  qualityRequest: DataQualityRequest,
): PatientCase {
  return {
    id,
    name,
    risk,
    reconciliationRequest,
    qualityRequest,
    reconciliationResult: null,
    qualityResult: null,
    reviewDecision: null,
    status: "Draft",
    activities: [],
  };
}

export const samplePatientCases: PatientCase[] = [
  buildCase("jane-doe", "Jane Doe", "high", sampleMedicationRequest, sampleQualityRequest),
  buildCase(
    "john-smith",
    "John Smith",
    "medium",
    demoTwoMedicationRequest,
    demoTwoQualityRequest,
  ),
  buildCase(
    "maria-garcia",
    "Maria Garcia",
    "low",
    {
      patient_context: {
        age: 42,
        conditions: ["Asthma"],
        recent_labs: {
          oxygen_saturation: "98%",
        },
      },
      sources: [
        {
          system: "Urgent care",
          medication: "Albuterol inhaler PRN",
          last_updated: "2026-03-07",
          source_reliability: "medium",
        },
        {
          system: "Primary care",
          medication: "Albuterol inhaler PRN",
          last_updated: "2026-03-10",
          source_reliability: "high",
        },
        {
          system: "Retail pharmacy",
          medication: "Fluticasone inhaler BID",
          last_filled: "2026-03-11",
          source_reliability: "medium",
        },
      ],
    },
    {
      demographics: {
        name: "Maria Garcia",
        dob: "1984-09-14",
        gender: "F",
      },
      medications: ["Albuterol", "Fluticasone"],
      allergies: ["Latex"],
      conditions: ["Asthma"],
      vital_signs: {
        blood_pressure: "118/72",
        heart_rate: 74,
      },
      last_updated: "2026-03-10",
    },
  ),
];
