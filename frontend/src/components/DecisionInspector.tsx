import { useMemo } from "react";
import type {
  DataQualityResponse,
  ReconcileMedicationRequest,
  ReconcileMedicationResponse,
  ReviewDecision,
} from "../types";
import { ScoreBar } from "./ScoreBar";
import { ScoreDial } from "./ScoreDial";
import { StatusPill } from "./StatusPill";

type DecisionInspectorProps = {
  request: ReconcileMedicationRequest;
  result: ReconcileMedicationResponse | null;
  qualityResult: DataQualityResponse | null;
  reviewDecision: ReviewDecision;
  rationale: string;
  onRationaleChange: (value: string) => void;
  onReviewDecisionChange: (
    decision: Exclude<ReviewDecision, null>,
    reason?: string,
  ) => void | Promise<void>;
};

function buildConfidenceFactors(result: ReconcileMedicationResponse) {
  if (!result.confidence_breakdown) {
    return [];
  }
  return [
    { label: "Source reliability", score: result.confidence_breakdown.source_reliability },
    { label: "Recency weighting", score: result.confidence_breakdown.recency_weighting },
    { label: "Clinical plausibility", score: result.confidence_breakdown.clinical_plausibility },
    { label: "Pharmacy fill verification", score: result.confidence_breakdown.fill_verification },
    { label: "Conflict penalty", score: Math.abs(result.confidence_breakdown.conflict_penalty) },
  ].map((item) => ({
    label: item.label,
    value: Math.round(item.score * 100),
    display: item.score.toFixed(2),
  }));
}

function humanizeToken(value: string) {
  return value.replace(/_/g, " ");
}

function toneForDecision(decision: ReviewDecision) {
  if (decision === "approved") {
    return "success" as const;
  }
  if (decision === "rejected") {
    return "danger" as const;
  }
  if (decision === "manual_review") {
    return "warning" as const;
  }
  return "neutral" as const;
}

export function DecisionInspector({
  request,
  result,
  qualityResult,
  reviewDecision,
  rationale,
  onRationaleChange,
  onReviewDecisionChange,
}: DecisionInspectorProps) {
  const requiresRationale = useMemo(
    () => ({
      rejected: !rationale.trim(),
      manual_review: !rationale.trim(),
    }),
    [rationale],
  );

  const safetyChecks = useMemo(() => {
    const missingAllergyFlag = qualityResult?.issues_detected.some((issue) => issue.field === "allergies");
    const kidneyCondition = request.patient_context.conditions.some((condition) =>
      condition.toLowerCase().includes("kidney"),
    );
    return [
      ["Renal function evaluated", kidneyCondition ? "checked" : "informational"],
      ["Drug-disease interaction checked", "checked"],
      ["Dose within safe range", result?.clinical_safety_check === "PASSED" ? "checked" : "warning"],
      ["Allergy documentation", missingAllergyFlag ? "warning" : "checked"],
    ] as const;
  }, [qualityResult, request.patient_context.conditions, result?.clinical_safety_check]);

  return (
    <section className="panel panel--sticky panel--inspector">
      <div className="panel__header panel__header--stacked">
        <div>
          <p className="eyebrow">AI Decision Inspector</p>
          <h2>Review panel</h2>
        </div>
        <StatusPill tone={toneForDecision(reviewDecision)}>
          {reviewDecision ? `Reviewer ${reviewDecision.replace("_", " ")}` : "Reviewer decision: Pending"}
        </StatusPill>
      </div>

      {result ? (
        <div className="result-stack">
          <div className="inspector-dial">
            <ScoreDial label="Confidence" value={Math.round(result.confidence_score * 100)} />
          </div>

          <div className="metric">
            <span className="metric__label">Chosen recommendation</span>
            <strong>{result.reconciled_medication}</strong>
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

          <div className="metric">
            <span className="metric__label">AI reasoning trace</span>
            <div className="trace-list">
              {result.reasoning_trace?.map((step, index) => (
                <div className="trace-item" key={`${step.label}-${index}`}>
                  <strong>{`Step ${index + 1}: ${humanizeToken(step.label)}`}</strong>
                  <p>{step.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="metric">
            <span className="metric__label">Deterministic rule hits</span>
            <ul className="clean-list">
              {(result.rule_hits || []).map((rule) => (
                <li key={rule}>{humanizeToken(rule)}</li>
              ))}
            </ul>
          </div>

          <div className="metric">
            <span className="metric__label">Confidence explanation</span>
            <div className="factor-list">
              {buildConfidenceFactors(result).map((factor) => (
                <div className="factor-card" key={factor.label}>
                  <div className="factor-row">
                    <span>{factor.label}</span>
                    <strong>{factor.display}</strong>
                  </div>
                  <ScoreBar label={factor.label} value={factor.value} />
                </div>
              ))}
            </div>
          </div>

          <div className="metric">
            <span className="metric__label">Source trust ranking</span>
            <div className="trace-list">
              {result.source_rankings.map((source) => (
                <div className="trace-item" key={`${source.rank}-${source.system}`}>
                  <strong>
                    {source.rank}. {source.system}
                  </strong>
                  <p>
                    Reliability score: {(source.score / 100).toFixed(2)}. {source.freshness_evidence}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="metric">
            <span className="metric__label">Evidence cards</span>
            <div className="trace-list">
              {(result.evidence_cards || []).map((card) => (
                <div className="trace-item" key={card.system}>
                  <strong>{card.system}</strong>
                  <p>Reliability: {card.reliability.toFixed(2)} · Recency: {card.recency}</p>
                  <p>Safety: {card.safety_notes.join(", ")}</p>
                  <p>Conflicts: {card.conflict_notes.join(", ")}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="metric">
            <span className="metric__label">Clinical safety check</span>
            <div className="safety-checks">
              {safetyChecks.map(([label, state]) => (
                <div className="safety-check" key={label}>
                  <span>{state === "warning" ? "!" : "✓"}</span>
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="metric">
            <span className="metric__label">Reviewer rationale</span>
            <textarea
              className="textarea"
              value={rationale}
              onChange={(event) => onRationaleChange(event.target.value)}
              placeholder="Required for reject and manual review. Use this to explain unresolved conflict, safety concern, or escalation."
            />
          </div>

          <div className="metric">
            <span className="metric__label">Case controls</span>
            <div className="button-row button-row--stacked">
              <button className="button" type="button" onClick={() => onReviewDecisionChange("approved", rationale.trim() || undefined)}>
                Approve Recommendation
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={requiresRationale.rejected}
                onClick={() => onReviewDecisionChange("rejected", rationale.trim())}
              >
                Reject Recommendation
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={requiresRationale.manual_review}
                onClick={() => onReviewDecisionChange("manual_review", rationale.trim())}
              >
                Request Manual Review
              </button>
            </div>
            {requiresRationale.rejected ? (
              <p className="metric__hint">Reject and manual-review actions require a rationale for audit integrity. Shortcut support is approve-only until rationale is present.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="inspector-placeholder">
          <strong>Run reconciliation to unlock the review panel</strong>
          <p className="empty-copy">This area will show the confidence dial, reasoning trace, source ranking, and reviewer controls.</p>
        </div>
      )}
    </section>
  );
}
