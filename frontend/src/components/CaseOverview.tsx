import type {
  CaseStatus,
  DataQualityRequest,
  DataQualityResponse,
  ReconcileMedicationRequest,
  ReconcileMedicationResponse,
  ReviewDecision,
} from "../types";
import { StatusPill } from "./StatusPill";

type CaseOverviewProps = {
  reconciliationRequest: ReconcileMedicationRequest | null;
  reconciliationResult: ReconcileMedicationResponse | null;
  qualityRequest: DataQualityRequest | null;
  qualityResult: DataQualityResponse | null;
  reviewDecision: ReviewDecision;
  status?: CaseStatus;
  onAddPatientClick?: () => void;
};

export function CaseOverview({
  reconciliationRequest,
  reconciliationResult,
  qualityRequest,
  qualityResult,
  reviewDecision,
  status,
  onAddPatientClick,
}: CaseOverviewProps) {
  const patientLabel = qualityRequest?.demographics.name || "Seeded reviewer case";
  const recentLabs = reconciliationRequest?.patient_context.recent_labs
    ? Object.entries(reconciliationRequest.patient_context.recent_labs)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(" · ")
    : "No recent labs loaded";
  const priority =
    reconciliationResult?.clinical_safety_check === "REQUIRES_REVIEW" || (qualityResult?.overall_score ?? 100) < 70
      ? "warning"
      : "success";

  return (
    <section className="panel panel--overview panel--identity">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Patient Summary</p>
          <h2>{patientLabel}</h2>
          <p className="workspace-card__copy">
            Reviewer context: conflicting metformin records with chronic kidney disease and a deliberately messy chart to demonstrate the two core workflows.
          </p>
          <div className="case-overview__brief">
            <span>Demo setup</span>
            <p>Hospital, primary care, and pharmacy records disagree on dose. The reviewer needs one reconciled answer plus a quick chart-quality sanity check before approval.</p>
          </div>
        </div>
        <div className="button-row">
          {onAddPatientClick ? (
            <button className="button button--secondary" type="button" onClick={onAddPatientClick}>
              Add New Patient
            </button>
          ) : null}
          <StatusPill tone={priority}>{priority === "warning" ? "Needs attention" : "Stable review"}</StatusPill>
        </div>
      </div>
      <div className="overview-metrics">
        <div className="overview-tile">
          <span>Case status</span>
          <strong>{status || (reviewDecision ? reviewDecision.replace("_", " ").toUpperCase() : "Reviewing")}</strong>
        </div>
        <div className="overview-tile">
          <span>Primary recommendation</span>
          <strong>{reconciliationResult?.reconciled_medication || "Pending reconciliation"}</strong>
        </div>
        <div className="overview-tile">
          <span>Data quality score</span>
          <strong>{qualityResult ? `${qualityResult.overall_score}/100` : "Awaiting validation"}</strong>
        </div>
        <div className="overview-tile">
          <span>Conditions</span>
          <strong>{reconciliationRequest?.patient_context.conditions.join(", ") || "Not loaded"}</strong>
        </div>
        <div className="overview-tile overview-tile--wide">
          <span>Recent labs</span>
          <strong>{recentLabs}</strong>
        </div>
      </div>
    </section>
  );
}
