import { useEffect, useMemo, useState } from "react";
import { reconcileMedication, runCaseReconciliation } from "../api";
import type { ReconcileMedicationRequest, ReconcileMedicationResponse } from "../types";
import { ScoreBar } from "./ScoreBar";
import { StatusPill } from "./StatusPill";

type ReconciliationPanelProps = {
  caseId?: string;
  request: ReconcileMedicationRequest;
  result?: ReconcileMedicationResponse | null;
  onResult?: (request: ReconcileMedicationRequest, result: ReconcileMedicationResponse) => void;
};

const loadingSteps = [
  "Gathering source records...",
  "Evaluating reliability...",
  "Checking drug safety...",
  "Computing recommendation...",
] as const;
const artificialDelayMs = import.meta.env.MODE === "test" ? 0 : 900;

function confidenceTone(score: number): "success" | "warning" | "danger" {
  if (score >= 0.8) {
    return "success";
  }
  if (score >= 0.5) {
    return "warning";
  }
  return "danger";
}

function conflictSeverity(
  request: ReconcileMedicationRequest,
  result: ReconcileMedicationResponse | null,
): { level: "HIGH" | "MEDIUM" | "LOW"; reason: string } {
  const kidneySignal = request.patient_context.conditions.some((condition) => condition.toLowerCase().includes("kidney"));
  const metforminSignal = (result?.reconciled_medication || "").toLowerCase().includes("metformin");

  if (kidneySignal && metforminSignal) {
    return {
      level: "HIGH",
      reason: "Metformin requires renal dosing review in CKD context. Patient eGFR signal indicates elevated clinical risk.",
    };
  }

  if ((result?.review_flags.length ?? 0) > 0) {
    return {
      level: "MEDIUM",
      reason: `Review flags present: ${result?.review_flags.join(", ")}.`,
    };
  }

  return {
    level: "LOW",
    reason: "No severe drug-disease conflict detected in the current set of source records.",
  };
}

function changeSummary(sourceMedication: string, chosenMedication: string) {
  if (sourceMedication === chosenMedication) {
    return "No change";
  }
  return "Dose or status changed during reconciliation";
}

function humanizeToken(value: string) {
  return value.replace(/_/g, " ");
}

export function ReconciliationPanel({ caseId, request, result: incomingResult, onResult }: ReconciliationPanelProps) {
  const [result, setResult] = useState<ReconcileMedicationResponse | null>(incomingResult || null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  useEffect(() => {
    setResult(incomingResult || null);
    setError(null);
  }, [incomingResult, request]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % loadingSteps.length);
    }, 450);

    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  async function handleSubmit() {
    setIsLoading(true);
    setLoadingStepIndex(0);
    setError(null);

    try {
      if (artificialDelayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, artificialDelayMs));
      }
      const response = caseId ? await runCaseReconciliation(caseId) : await reconcileMedication(request);
      setResult(response);
      onResult?.(request, response);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unknown error");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  const severity = useMemo(() => {
    if (result?.conflict_severity) {
      return {
        level: result.conflict_severity.level as "HIGH" | "MEDIUM" | "LOW",
        reason: result.conflict_severity.explanation,
      };
    }
    return conflictSeverity(request, result);
  }, [request, result]);

  return (
    <section className="panel panel--evidence">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Medication Reconciliation Diff View</p>
          <h2>Source-by-source comparison</h2>
        </div>
        <div className="button-row">
          <button className="button" type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Reconciling..." : "Run Reconciliation"}
          </button>
        </div>
      </div>

      <div className="panel__subhead">
        <p className="panel__lede">Compare conflicting medication records side by side and produce an explainable reviewer recommendation the interviewer can understand at a glance.</p>
        {result ? (
          <div className="button-row panel__status-row">
            <StatusPill tone={confidenceTone(result.confidence_score)}>
              {Math.round(result.confidence_score * 100)}% confidence
            </StatusPill>
            <StatusPill
              tone={
                result.recommendation_disposition === "safe_to_approve"
                  ? "success"
                  : result.recommendation_disposition === "manual_review_recommended"
                    ? "danger"
                    : "warning"
              }
            >
              {humanizeToken(result.recommendation_disposition || "requires_review")}
            </StatusPill>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="workflow-loader">
          <div className="workflow-loader__bars">
            <span />
            <span />
            <span />
          </div>
          <strong>{loadingSteps[loadingStepIndex]}</strong>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="workspace-card workspace-card--muted">
        <div className="workspace-card__header">
          <div>
            <p className="eyebrow">Source Records</p>
            <h3>Structured medication table</h3>
            <p className="workspace-card__copy">This is the core conflict: recent primary care dosing versus older hospital and pharmacy records.</p>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>System</th>
              <th>Medication</th>
              <th>Updated</th>
              <th>Reliability</th>
            </tr>
          </thead>
          <tbody>
            {request.sources.map((source) => (
              <tr key={`${source.system}-${source.medication}`}>
                <td>{source.system}</td>
                <td>{source.medication}</td>
                <td>{source.last_updated || source.last_filled || "Unknown"}</td>
                <td>
                  <span className={`reliability-tag reliability-tag--${source.source_reliability.toLowerCase()}`}>
                    {source.source_reliability}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result?.rule_hits?.length ? (
        <div className="workspace-card workspace-card--muted">
          <div className="workspace-card__header">
            <div>
              <p className="eyebrow">Rule Hits</p>
              <h3>Deterministic explanation</h3>
            </div>
          </div>
          <ul className="clean-list">
            {result.rule_hits.map((rule) => (
              <li key={rule}>{humanizeToken(rule)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel__split">
        <div className="workspace-card">
          <div className="workspace-card__header">
            <div>
              <p className="eyebrow">What Changed?</p>
              <h3>Clinical diff</h3>
            </div>
          </div>
          <div className="diff-list">
            {request.sources.map((source) => {
              const change = result?.what_changed?.find((item) => item.system === source.system);
              const chosenMedication = change?.reconciled_medication || result?.reconciled_medication || source.medication;
              const isChosen = result?.selected_source_system === source.system;
              const changed = change?.changed ?? source.medication !== chosenMedication;

              return (
                <div className={`diff-row ${changed ? "diff-row--conflict" : ""} ${isChosen ? "diff-row--chosen" : ""}`} key={`${source.system}-${source.medication}`}>
                  <div className="diff-row__source">{source.system}</div>
                  <div className="diff-row__value">
                    <strong>{source.medication}</strong>
                    {changed ? (
                      <p className="diff-row__change">
                        ↓ {chosenMedication}
                        <br />
                        <span>{change?.explanation || changeSummary(source.medication, chosenMedication)}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="diff-row__badge">{isChosen ? <StatusPill tone="success">chosen</StatusPill> : null}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="workspace-card">
          <div className="workspace-card__header">
            <div>
              <p className="eyebrow">Conflict Severity</p>
              <h3>Clinical risk framing</h3>
            </div>
            <StatusPill tone={severity.level === "HIGH" ? "danger" : severity.level === "MEDIUM" ? "warning" : "success"}>
              {severity.level}
            </StatusPill>
          </div>
          <div className="result-stack">
            <div className="metric">
              <span className="metric__label">Reason</span>
              <p>{severity.reason}</p>
            </div>
            {request.patient_context.recent_labs?.egfr ? (
              <div className="metric">
                <span className="metric__label">Patient eGFR</span>
                <strong>{String(request.patient_context.recent_labs.egfr)}</strong>
              </div>
            ) : null}
            <div className="metric">
              <span className="metric__label">Final decision</span>
              <strong>{result?.reconciled_medication || "Awaiting reconciliation"}</strong>
            </div>
            {result ? <ScoreBar label="Confidence Score" value={Math.round(result.confidence_score * 100)} /> : null}
          </div>
        </div>
      </div>

      {result?.evidence_cards?.length ? (
        <div className="workspace-card">
          <div className="workspace-card__header">
            <div>
              <p className="eyebrow">Evidence Cards</p>
              <h3>Per-source decision evidence</h3>
            </div>
          </div>
          <div className="trace-list">
            {result.evidence_cards.map((card) => (
              <div className="trace-item" key={card.system}>
                <strong>{card.system}</strong>
                <p>Reliability: {card.reliability.toFixed(2)}</p>
                <p>Recency: {card.recency}</p>
                <p>Safety notes: {card.safety_notes.join(", ")}</p>
                <p>Conflict notes: {card.conflict_notes.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
