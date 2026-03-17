import { useEffect, useMemo, useState } from "react";
import { runCaseDataQuality, validateDataQuality } from "../api";
import type { DataQualityRequest, DataQualityResponse, IssueDetected } from "../types";
import { ScoreDial } from "./ScoreDial";
import { ScoreBar } from "./ScoreBar";
import { StatusPill } from "./StatusPill";

type DataQualityPanelProps = {
  caseId?: string;
  request: DataQualityRequest;
  result?: DataQualityResponse | null;
  onResult?: (request: DataQualityRequest, result: DataQualityResponse) => void;
};

type IssueFilter = "all" | "blocking" | "high" | "completeness" | "plausibility";

function severityTone(severity: string): "warning" | "danger" | "neutral" {
  if (severity === "high") {
    return "danger";
  }
  if (severity === "medium") {
    return "warning";
  }
  return "neutral";
}

function filterIssues(issues: IssueDetected[], filter: IssueFilter) {
  switch (filter) {
    case "blocking":
      return issues.filter((issue) => issue.blocking);
    case "high":
      return issues.filter((issue) => issue.severity === "high");
    case "completeness":
      return issues.filter((issue) => issue.domain === "completeness");
    case "plausibility":
      return issues.filter((issue) => issue.domain === "plausibility");
    default:
      return issues;
  }
}

export function DataQualityPanel({ caseId, request, result: incomingResult, onResult }: DataQualityPanelProps) {
  const [result, setResult] = useState<DataQualityResponse | null>(incomingResult || null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueDetected | null>(null);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");

  useEffect(() => {
    setResult(incomingResult || null);
    setError(null);
    setSelectedIssue(null);
    setIssueFilter("all");
  }, [incomingResult, request]);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);

    try {
      const response = caseId ? await runCaseDataQuality(caseId) : await validateDataQuality(request);
      setResult(response);
      setSelectedIssue(response.issues_detected[0] || null);
      onResult?.(request, response);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unknown error");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  const visibleIssues = useMemo(
    () => filterIssues(result?.issues_detected || [], issueFilter),
    [issueFilter, result?.issues_detected],
  );

  return (
    <section className="panel panel--quality">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Data Quality Validation</p>
          <h2>Chart integrity and remediation review</h2>
          <p className="workspace-card__copy">
            This seeded record intentionally includes missing allergies, stale metadata, and implausible vitals so the quality model has clear reviewer-facing findings.
          </p>
        </div>
        <div className="button-row">
          <button className="button" type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Validating..." : "Validate Data Quality"}
          </button>
        </div>
      </div>

      <div className="panel__split">
        <div className="workspace-card workspace-card--muted">
          <div className="workspace-card__header">
            <div>
              <p className="eyebrow">Patient Record Snapshot</p>
              <h3>Structured chart fields</h3>
            </div>
          </div>
          <table className="data-table data-table--compact">
            <tbody>
              <tr><th>Patient</th><td>{request.demographics.name}</td></tr>
              <tr><th>DOB</th><td>{request.demographics.dob}</td></tr>
              <tr><th>Gender</th><td>{request.demographics.gender}</td></tr>
              <tr><th>Medications</th><td>{request.medications.join(", ")}</td></tr>
              <tr><th>Allergies</th><td>{request.allergies.length ? request.allergies.join(", ") : "Not documented"}</td></tr>
              <tr><th>Vitals</th><td>{request.vital_signs.blood_pressure || "N/A"} · HR {request.vital_signs.heart_rate ?? "N/A"}</td></tr>
              <tr><th>Last updated</th><td>{request.last_updated}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="workspace-card">
          <div className="workspace-card__header">
            <div>
              <p className="eyebrow">Quality Assessment</p>
              <h3>Scorecard</h3>
            </div>
            {result ? (
              <StatusPill tone={result.overall_score >= 80 ? "success" : result.overall_score >= 60 ? "warning" : "danger"}>
                {result.overall_score}/100
              </StatusPill>
            ) : null}
          </div>

          {error ? <p className="error">{error}</p> : null}

          {result ? (
            <div className="result-stack">
              <div className="metric metric--dial">
                <ScoreDial label="Overall" value={result.overall_score} />
                <div>
                  <span className="metric__label">Summary</span>
                  <p>{result.summary}</p>
                </div>
              </div>
              <ScoreBar label="Completeness" value={result.breakdown.completeness} />
              <ScoreBar label="Accuracy" value={result.breakdown.accuracy} />
              <ScoreBar label="Timeliness" value={result.breakdown.timeliness} />
              <ScoreBar label="Clinical plausibility" value={result.breakdown.clinical_plausibility} />
              {result.recommended_follow_up?.length ? (
                <div className="metric metric--callout">
                  <span className="metric__label">Recommended follow-up</span>
                  <ul className="clean-list clean-list--tight">
                    {result.recommended_follow_up.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.record_freshness ? (
                <div className="metric">
                  <span className="metric__label">Record freshness</span>
                  <strong>{result.record_freshness}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="empty-copy">Run validation to populate the score dial, breakdown, and issue list.</p>
          )}
        </div>
      </div>

      <div className="panel__split">
        <div className="workspace-card workspace-card--muted">
          <div className="workspace-card__header">
            <div>
              <p className="eyebrow">Issues Detected</p>
              <h3>Diagnostic findings</h3>
            </div>
            <div className="button-row button-row--wrap">
              {(["all", "blocking", "high", "completeness", "plausibility"] as IssueFilter[]).map((filter) => (
                <button
                  key={filter}
                  className={`button button--secondary ${issueFilter === filter ? "button--active" : ""}`}
                  type="button"
                  onClick={() => setIssueFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          {visibleIssues.length ? (
            <div className="issue-grid">
              {visibleIssues.map((issue) => (
                <button
                  className={`issue-item issue-item--button ${selectedIssue?.field === issue.field && selectedIssue?.issue === issue.issue ? "issue-item--active" : ""}`}
                  key={`${issue.field}-${issue.issue}`}
                  type="button"
                  onClick={() => setSelectedIssue(issue)}
                >
                  <div className="issue-item__row">
                    <strong>{issue.field}</strong>
                    <StatusPill tone={issue.blocking ? "danger" : severityTone(issue.severity)}>
                      {issue.blocking ? "blocking" : issue.severity}
                    </StatusPill>
                  </div>
                  <p>{issue.issue}</p>
                  <p>{issue.remediation}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No issues match the current filter.</p>
          )}
        </div>

        <div className="workspace-card">
          <div className="workspace-card__header">
            <div>
              <p className="eyebrow">Selected Issue</p>
              <h3>Clinical diagnostic detail</h3>
            </div>
          </div>
          {selectedIssue ? (
            <div className="result-stack">
              <div className="metric">
                <span className="metric__label">Field</span>
                <strong>{selectedIssue.field}</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Issue</span>
                <p>{selectedIssue.issue}</p>
              </div>
              <div className="metric">
                <span className="metric__label">Domain</span>
                <strong>{selectedIssue.domain}</strong>
              </div>
              <div className="metric">
                <span className="metric__label">Why it matters clinically</span>
                <p>{result?.field_diagnostics?.find((item) => item.field === selectedIssue.field)?.detail || selectedIssue.issue}</p>
              </div>
              <div className="metric">
                <span className="metric__label">Suggested reviewer action</span>
                <p>{selectedIssue.remediation}</p>
              </div>
              <div className="metric">
                <span className="metric__label">Approval impact</span>
                <StatusPill tone={selectedIssue.blocking ? "danger" : "warning"}>
                  {selectedIssue.approval_impact}
                </StatusPill>
              </div>
            </div>
          ) : (
            <p className="empty-copy">Click an issue to inspect why it was flagged, whether it blocks approval, and how to remediate it.</p>
          )}
        </div>
      </div>
    </section>
  );
}
