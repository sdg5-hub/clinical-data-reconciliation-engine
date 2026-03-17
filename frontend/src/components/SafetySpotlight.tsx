import type {
  DataQualityRequest,
  DataQualityResponse,
  ReconcileMedicationRequest,
  ReconcileMedicationResponse,
} from "../types";
import { StatusPill } from "./StatusPill";

type SpotlightSignal = {
  title: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

type SafetySpotlightProps = {
  reconciliationRequest: ReconcileMedicationRequest | null;
  reconciliationResult: ReconcileMedicationResponse | null;
  qualityRequest: DataQualityRequest | null;
  qualityResult: DataQualityResponse | null;
};

function buildSignals(
  reconciliationRequest: ReconcileMedicationRequest | null,
  reconciliationResult: ReconcileMedicationResponse | null,
  qualityRequest: DataQualityRequest | null,
  qualityResult: DataQualityResponse | null,
): SpotlightSignal[] {
  const signals: SpotlightSignal[] = [];
  const allergies = qualityRequest?.allergies ?? [];
  const conditions = new Set([...(qualityRequest?.conditions ?? []), ...(reconciliationRequest?.patient_context.conditions ?? [])].map((value) => value.toLowerCase()));
  const meds = [reconciliationResult?.reconciled_medication ?? "", ...(qualityRequest?.medications ?? [])].join(" ").toLowerCase();

  if (!allergies.length) {
    signals.push({
      title: "Allergy documentation gap",
      detail: "No allergy list is present. Flag for reviewer confirmation before clinical sign-off.",
      tone: "warning",
    });
  } else {
    signals.push({
      title: "Allergies documented",
      detail: `Documented allergies: ${allergies.join(", ")}.`,
      tone: "success",
    });
  }

  if (conditions.has("chronic kidney disease") && meds.includes("metformin")) {
    signals.push({
      title: "Renal dosing risk",
      detail: "Metformin appears in the reconciled regimen while chronic kidney disease is present in the case context.",
      tone: "danger",
    });
  }

  if (qualityResult && qualityResult.breakdown.timeliness < 70) {
    signals.push({
      title: "Stale record window",
      detail: "Timeliness is below 70, so downstream decisions may be based on outdated information.",
      tone: "warning",
    });
  }

  if (reconciliationResult?.review_flags.length) {
    signals.push({
      title: "Manual review required",
      detail: `Active review flags: ${reconciliationResult.review_flags.join(", ")}.`,
      tone: "warning",
    });
  }

  if (!signals.length) {
    signals.push({
      title: "No safety concerns surfaced yet",
      detail: "Run both workflows to populate safety signals and reviewer recommendations.",
      tone: "neutral",
    });
  }

  return signals;
}

export function SafetySpotlight(props: SafetySpotlightProps) {
  const signals = buildSignals(
    props.reconciliationRequest,
    props.reconciliationResult,
    props.qualityRequest,
    props.qualityResult,
  );

  return (
    <section className="workspace-grid workspace-grid--two">
      <div className="workspace-card">
        <div className="workspace-card__header">
          <div>
            <p className="eyebrow">Safety Spotlight</p>
            <h2>Allergies, risk, and chart hygiene</h2>
          </div>
        </div>
        <ul className="issue-list">
          {signals.map((signal) => (
            <li className="issue-item" key={signal.title}>
              <div className="issue-item__row">
                <strong>{signal.title}</strong>
                <StatusPill tone={signal.tone}>{signal.tone}</StatusPill>
              </div>
              <p>{signal.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
