import { useState } from "react";
import type { DataQualityRequest, ReconcileMedicationRequest, ScanHistoryItem } from "../types";
import { NewPatientPanel } from "./NewPatientPanel";

type DemoScenario = {
  id: "demo1" | "demo2";
  title: string;
  subtitle: string;
  reconciliationRequest: ReconcileMedicationRequest;
  qualityRequest: DataQualityRequest;
};

type DemoControlPanelProps = {
  activeDemoId: "demo1" | "demo2" | "custom";
  scenarios: DemoScenario[];
  onLoadScenario: (scenario: DemoScenario) => void;
  onCreateCase: (payload: {
    reconciliationRequest: ReconcileMedicationRequest;
    qualityRequest: DataQualityRequest;
    pendingScanEvents: ScanHistoryItem[];
  }) => void;
};

export function DemoControlPanel({
  activeDemoId,
  scenarios,
  onLoadScenario,
  onCreateCase,
}: DemoControlPanelProps) {
  const [showNewPatient, setShowNewPatient] = useState(false);

  return (
    <section className="panel panel--tools">
      <div className="panel__header panel__header--stacked">
        <div>
          <p className="eyebrow">Demo And Intake Tools</p>
          <h2>Scenarios and camera capture</h2>
          <p className="workspace-card__copy">
            Use the prepared demos for a fast walkthrough, or create a fresh patient with barcode/OCR-assisted medication capture.
          </p>
        </div>
      </div>

      <div className="demo-control-list">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            className={`demo-control-card ${activeDemoId === scenario.id ? "demo-control-card--active" : ""}`}
            type="button"
            onClick={() => onLoadScenario(scenario)}
          >
            <div className="demo-control-card__header">
              <strong>{scenario.title}</strong>
              <span>{activeDemoId === scenario.id ? "active" : "load"}</span>
            </div>
            <p>{scenario.subtitle}</p>
          </button>
        ))}
      </div>

      <div className="button-row">
        <button
          className={`button button--secondary ${showNewPatient ? "button--active" : ""}`}
          type="button"
          onClick={() => setShowNewPatient((current) => !current)}
        >
          {showNewPatient ? "Close New Patient" : "New Patient"}
        </button>
      </div>

      {showNewPatient ? (
        <div className="demo-control-panel__intake">
          <NewPatientPanel onCreateCase={onCreateCase} />
        </div>
      ) : (
        <div className="demo-control-panel__hint">
          <strong>Camera-related feature included</strong>
          <p>
            Open <strong>New Patient</strong> to use the medication scanner with camera, uploaded image, manual code entry, and OCR-assisted label capture.
          </p>
        </div>
      )}
    </section>
  );
}
