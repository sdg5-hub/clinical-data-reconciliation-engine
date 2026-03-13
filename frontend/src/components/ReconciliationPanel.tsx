import { useState } from "react";
import { reconcileMedication } from "../api";
import { sampleMedicationRequest } from "../sampleData";
import type { ReconcileMedicationResponse } from "../types";
import { JsonEditor } from "./JsonEditor";
import { StatusPill } from "./StatusPill";

const initialJson = JSON.stringify(sampleMedicationRequest, null, 2);

function confidenceTone(score: number): "success" | "warning" | "danger" {
  if (score >= 0.8) {
    return "success";
  }
  if (score >= 0.5) {
    return "warning";
  }
  return "danger";
}

export function ReconciliationPanel() {
  const [payload, setPayload] = useState(initialJson);
  const [result, setResult] = useState<ReconcileMedicationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected" | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);

    try {
      const parsed = JSON.parse(payload);
      const response = await reconcileMedication(parsed);
      setResult(response);
      setReviewDecision(null);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unknown error");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setPayload(initialJson);
    setError(null);
    setResult(null);
    setReviewDecision(null);
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Workflow 01</p>
          <h2>Medication Reconciliation</h2>
        </div>
        <div className="button-row">
          <button className="button button--secondary" type="button" onClick={handleReset} disabled={isLoading}>
            Reset Seeded Case
          </button>
          <button className="button" type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Reconciling..." : "Run Reconciliation"}
          </button>
        </div>
      </div>

      <p className="panel__description">
        Compare source medication records and generate a clinician-facing recommendation with confidence and
        follow-up actions.
      </p>

      <div className="panel__grid">
        <JsonEditor label="Request Payload" value={payload} onChange={setPayload} />

        <div className="result-card">
          <div className="result-card__header">
            <h3>Decision Support Output</h3>
            {result ? (
              <StatusPill tone={confidenceTone(result.confidence_score)}>
                Confidence {Math.round(result.confidence_score * 100)}%
              </StatusPill>
            ) : (
              <StatusPill tone="neutral">Awaiting run</StatusPill>
            )}
          </div>

          {error ? <p className="error">{error}</p> : null}

          {result ? (
            <div className="result-stack">
              <div className="metric">
                <span className="metric__label">Reconciled medication</span>
                <strong>{result.reconciled_medication}</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Clinical safety check</span>
                <strong>{result.clinical_safety_check}</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Selected source</span>
                <strong>{result.selected_source_system}</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Review flags</span>
                {result.review_flags.length ? (
                  <ul className="clean-list">
                    {result.review_flags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No active review flags.</p>
                )}
              </div>
              <div className="metric">
                <span className="metric__label">Reasoning</span>
                <p>{result.reasoning}</p>
              </div>
              <div className="metric">
                <span className="metric__label">Recommended actions</span>
                <ul className="clean-list">
                  {result.recommended_actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
              <div className="metric">
                <span className="metric__label">Reviewer decision</span>
                <div className="button-row button-row--start">
                  <button
                    className={`button button--secondary ${reviewDecision === "approved" ? "button--active" : ""}`}
                    type="button"
                    onClick={() => setReviewDecision("approved")}
                  >
                    Approve Suggestion
                  </button>
                  <button
                    className={`button button--secondary ${reviewDecision === "rejected" ? "button--active" : ""}`}
                    type="button"
                    onClick={() => setReviewDecision("rejected")}
                  >
                    Reject Suggestion
                  </button>
                </div>
                {reviewDecision ? <p>Reviewer marked this suggestion as {reviewDecision}.</p> : <p>No reviewer decision recorded yet.</p>}
              </div>
              <div className="metric">
                <span className="metric__label">Source rankings</span>
                <ul className="issue-list">
                  {result.source_rankings.map((source) => (
                    <li className="issue-item" key={`${source.rank}-${source.system}-${source.medication}`}>
                      <div className="issue-item__row">
                        <strong>
                          #{source.rank} {source.system}
                        </strong>
                        <StatusPill tone={source.rank === 1 ? "success" : "neutral"}>Score {source.score}</StatusPill>
                      </div>
                      <p>{source.medication}</p>
                      <p className="issue-item__meta">
                        Normalized: {source.normalized_medication} | Reliability: {source.reliability} | Evidence:{" "}
                        {source.freshness_evidence}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="empty-copy">
              Demo suggestion: compare EHR, pharmacy, and care-management sources, then inspect the confidence and
              recommended follow-up actions.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
