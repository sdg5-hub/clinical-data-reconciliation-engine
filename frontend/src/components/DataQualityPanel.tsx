import { useState } from "react";
import { validateDataQuality } from "../api";
import { sampleQualityRequest } from "../sampleData";
import type { DataQualityResponse } from "../types";
import { JsonEditor } from "./JsonEditor";
import { ScoreBar } from "./ScoreBar";
import { StatusPill } from "./StatusPill";

const initialJson = JSON.stringify(sampleQualityRequest, null, 2);

function severityTone(severity: string): "warning" | "danger" | "neutral" {
  if (severity === "high") {
    return "danger";
  }
  if (severity === "medium") {
    return "warning";
  }
  return "neutral";
}

export function DataQualityPanel() {
  const [payload, setPayload] = useState(initialJson);
  const [result, setResult] = useState<DataQualityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);

    try {
      const parsed = JSON.parse(payload);
      const response = await validateDataQuality(parsed);
      setResult(response);
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
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Workflow 02</p>
          <h2>Clinical Data Quality Review</h2>
        </div>
        <div className="button-row">
          <button className="button button--secondary" type="button" onClick={handleReset} disabled={isLoading}>
            Reset Seeded Case
          </button>
          <button className="button" type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Analyzing..." : "Validate Data Quality"}
          </button>
        </div>
      </div>

      <p className="panel__description">
        Score completeness, accuracy, timeliness, and plausibility so reviewers can prioritize records that
        need manual intervention.
      </p>

      <div className="panel__grid">
        <JsonEditor label="Request Payload" value={payload} onChange={setPayload} />

        <div className="result-card">
          <div className="result-card__header">
            <h3>Quality Assessment Output</h3>
            {result ? (
              <StatusPill tone={result.overall_score >= 80 ? "success" : result.overall_score >= 60 ? "warning" : "danger"}>
                Overall score {result.overall_score}
              </StatusPill>
            ) : (
              <StatusPill tone="neutral">Awaiting run</StatusPill>
            )}
          </div>

          {error ? <p className="error">{error}</p> : null}

          {result ? (
            <div className="result-stack">
              <div className="metric">
                <span className="metric__label">Summary</span>
                <p>{result.summary}</p>
              </div>
              <ScoreBar label="Completeness" value={result.breakdown.completeness} />
              <ScoreBar label="Accuracy" value={result.breakdown.accuracy} />
              <ScoreBar label="Timeliness" value={result.breakdown.timeliness} />
              <ScoreBar label="Clinical plausibility" value={result.breakdown.clinical_plausibility} />

              <div className="metric">
                <span className="metric__label">Issues detected</span>
                <ul className="issue-list">
                  {result.issues_detected.map((issue) => (
                    <li className="issue-item" key={`${issue.field}-${issue.issue}`}>
                      <div className="issue-item__row">
                        <strong>{issue.field}</strong>
                        <StatusPill tone={severityTone(issue.severity)}>{issue.severity}</StatusPill>
                      </div>
                      <p>{issue.issue}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="empty-copy">
              Demo suggestion: run the seeded record to surface missing allergies, implausible vitals, and stale
              last-updated metadata.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
