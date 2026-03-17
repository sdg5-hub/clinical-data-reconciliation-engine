import { useState } from "react";
import type { DataQualityRequest, ReconcileMedicationRequest, ScanHistoryItem } from "../types";
import { MedicationScannerPanel } from "./MedicationScannerPanel";

type NewPatientPanelProps = {
  onCreateCase: (payload: {
    reconciliationRequest: ReconcileMedicationRequest;
    qualityRequest: DataQualityRequest;
    pendingScanEvents: ScanHistoryItem[];
  }) => void;
};

type FormState = {
  name: string;
  age: string;
  dob: string;
  gender: string;
  primaryMedication: string;
  medications: string;
  conditions: string;
  allergies: string;
  bloodPressure: string;
  heartRate: string;
};

const initialState: FormState = {
  name: "",
  age: "45",
  dob: "1980-01-01",
  gender: "F",
  primaryMedication: "Aspirin 81mg daily",
  medications: "Aspirin 81mg daily, Lisinopril 10mg daily",
  conditions: "Hypertension",
  allergies: "Penicillin",
  bloodPressure: "128/82",
  heartRate: "76",
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function NewPatientPanel({ onCreateCase }: NewPatientPanelProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [pendingScanEvents, setPendingScanEvents] = useState<ScanHistoryItem[]>([]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit() {
    const medications = splitCsv(form.medications);
    const conditions = splitCsv(form.conditions);
    const allergies = splitCsv(form.allergies);
    const primaryMedication = form.primaryMedication.trim() || medications[0] || "Aspirin 81mg daily";

    onCreateCase({
      reconciliationRequest: {
        patient_context: {
          age: Number(form.age) || 45,
          conditions,
          recent_labs: null,
        },
        sources: [
          {
            system: "Epic EHR",
            medication: primaryMedication,
            last_updated: isoToday(),
            source_reliability: "high",
          },
          {
            system: "Retail pharmacy",
            medication: primaryMedication,
            last_filled: isoToday(),
            source_reliability: "medium",
          },
          {
            system: "Patient portal",
            medication: primaryMedication,
            last_updated: isoToday(),
            source_reliability: "low",
          },
        ],
      },
      qualityRequest: {
        demographics: {
          name: form.name.trim() || "New Patient",
          dob: form.dob,
          gender: form.gender,
        },
        medications,
        allergies,
        conditions,
        vital_signs: {
          blood_pressure: form.bloodPressure,
          heart_rate: Number(form.heartRate) || 76,
        },
        last_updated: isoToday(),
      },
      pendingScanEvents,
    });
  }

  function handleScannedMedication(payload: { inferredMedication: string; scanEvent?: ScanHistoryItem }) {
    setForm((current) => {
      const medications = splitCsv(current.medications);
      const nextMedicationList = medications.includes(payload.inferredMedication)
        ? medications
        : [payload.inferredMedication, ...medications];

      return {
        ...current,
        primaryMedication: payload.inferredMedication,
        medications: nextMedicationList.join(", "),
      };
    });
    if (payload.scanEvent) {
      setPendingScanEvents((current) => [payload.scanEvent as ScanHistoryItem, ...current].slice(0, 10));
    }
  }

  return (
    <section className="panel">
      <div className="panel__header panel__header--stacked">
        <div>
          <p className="eyebrow">Add New Patient</p>
          <h2>Create a fresh review case</h2>
        </div>
      </div>
      <div className="intake-grid">
        <label className="intake-field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
        </label>
        <label className="intake-field">
          <span>Age</span>
          <input value={form.age} onChange={(event) => updateField("age", event.target.value)} />
        </label>
        <label className="intake-field">
          <span>Date of birth</span>
          <input value={form.dob} onChange={(event) => updateField("dob", event.target.value)} />
        </label>
        <label className="intake-field">
          <span>Gender</span>
          <input value={form.gender} onChange={(event) => updateField("gender", event.target.value)} />
        </label>
        <label className="intake-field intake-field--full">
          <span>Primary medication</span>
          <input value={form.primaryMedication} onChange={(event) => updateField("primaryMedication", event.target.value)} />
        </label>
        <label className="intake-field intake-field--full">
          <span>Medication list (comma-separated)</span>
          <input value={form.medications} onChange={(event) => updateField("medications", event.target.value)} />
        </label>
        <label className="intake-field intake-field--full">
          <span>Conditions (comma-separated)</span>
          <input value={form.conditions} onChange={(event) => updateField("conditions", event.target.value)} />
        </label>
        <label className="intake-field intake-field--full">
          <span>Allergies (comma-separated)</span>
          <input value={form.allergies} onChange={(event) => updateField("allergies", event.target.value)} />
        </label>
        <label className="intake-field">
          <span>Blood pressure</span>
          <input value={form.bloodPressure} onChange={(event) => updateField("bloodPressure", event.target.value)} />
        </label>
        <label className="intake-field">
          <span>Heart rate</span>
          <input value={form.heartRate} onChange={(event) => updateField("heartRate", event.target.value)} />
        </label>
      </div>
      <MedicationScannerPanel onApplyMedication={handleScannedMedication} />
      <div className="button-row">
        <button className="button" type="button" onClick={handleSubmit}>
          Add New Patient
        </button>
      </div>
    </section>
  );
}
