import type { CaseStatus, PatientCase } from "../types";
import { StatusPill } from "./StatusPill";

type PatientSidebarProps = {
  cases: PatientCase[];
  selectedCaseId: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectCase: (caseId: string) => void;
  alerts: { id: string; label: string; tone: "danger" | "warning" | "neutral" }[];
  onAddPatientClick: () => void;
};

function statusTone(status: CaseStatus): "neutral" | "warning" | "success" {
  if (status === "Approved" || status === "Resolved") {
    return "success";
  }
  if (status === "Awaiting clinician" || status === "Reviewing") {
    return "warning";
  }
  return "neutral";
}

export function PatientSidebar({
  cases,
  selectedCaseId,
  searchQuery,
  onSearchChange,
  onSelectCase,
  alerts,
  onAddPatientClick,
}: PatientSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__section">
        <p className="eyebrow eyebrow--accent">Clinical Investigation Workspace</p>
        <h1 className="sidebar__title">Case Queue</h1>
        <p className="sidebar__copy">Review patient conflicts, data quality signals, and reviewer decisions from one workstation.</p>
        <label className="sidebar__search">
          <span className="sr-only">Search patients</span>
          <input
            aria-label="Search patients"
            placeholder="Search patient or condition"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <button className="button sidebar__button" type="button" onClick={onAddPatientClick}>
          Add New Patient
        </button>
      </div>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <h2>Patients</h2>
          <span>{cases.length}</span>
        </div>
        <div className="patient-list">
          {cases.map((patientCase) => (
            <button
              key={patientCase.id}
              className={`patient-list__item ${patientCase.id === selectedCaseId ? "patient-list__item--active" : ""}`}
              type="button"
              onClick={() => onSelectCase(patientCase.id)}
            >
              <div>
                <strong>{patientCase.name}</strong>
                <span>{patientCase.reconciliationRequest.patient_context.conditions.join(", ")}</span>
              </div>
              <div className="patient-list__meta">
                <StatusPill tone={patientCase.risk === "high" ? "danger" : patientCase.risk === "medium" ? "warning" : "success"}>
                  {patientCase.risk} risk
                </StatusPill>
                <StatusPill tone={statusTone(patientCase.status)}>{patientCase.status}</StatusPill>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <h2>Alerts</h2>
          <span>{alerts.length}</span>
        </div>
        <div className="alert-stack">
          {alerts.length ? (
            alerts.map((alert) => (
              <div className={`alert-card alert-card--${alert.tone}`} key={alert.id}>
                <strong>{alert.label}</strong>
              </div>
            ))
          ) : (
            <p className="empty-copy">Run workflows to populate conflict and data quality alerts.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
