import type {
  DataQualityRequest,
  DataQualityResponse,
  ReconcileMedicationRequest,
  ReconcileMedicationResponse,
} from "../types";
import { StatusPill } from "./StatusPill";

type RiskHeatmapProps = {
  reconciliationRequest: ReconcileMedicationRequest;
  reconciliationResult: ReconcileMedicationResponse | null;
  qualityRequest: DataQualityRequest;
  qualityResult: DataQualityResponse | null;
};

type RiskBucket = {
  level: "HIGH" | "MEDIUM" | "LOW";
  items: { title: string; detail: string }[];
};

function buildBuckets(
  reconciliationRequest: ReconcileMedicationRequest,
  reconciliationResult: ReconcileMedicationResponse | null,
  qualityRequest: DataQualityRequest,
  qualityResult: DataQualityResponse | null,
): RiskBucket[] {
  const high: RiskBucket["items"] = [];
  const medium: RiskBucket["items"] = [];
  const low: RiskBucket["items"] = [];
  const egfr = reconciliationRequest.patient_context.recent_labs?.egfr;

  if (
    reconciliationRequest.patient_context.conditions.some((condition) => condition.toLowerCase().includes("kidney")) &&
    (reconciliationResult?.reconciled_medication || "").toLowerCase().includes("metformin")
  ) {
    high.push({
      title: "Renal dosing risk",
      detail: `Metformin 1000mg BID may be unsafe in CKD context. Patient eGFR: ${String(egfr ?? "unknown")}. Recommended max dose: 500mg BID.`,
    });
  }

  if (qualityResult?.issues_detected.some((issue) => issue.severity === "high")) {
    high.push({
      title: "Implausible vitals",
      detail: "A high-severity physiologic abnormality was detected in the chart and should be manually confirmed.",
    });
  }

  if (!qualityRequest.allergies.length) {
    medium.push({
      title: "Missing allergy list",
      detail: "Allergy documentation is empty, which weakens medication safety review.",
    });
  }

  if (reconciliationResult?.review_flags.length) {
    medium.push({
      title: "Manual review flags",
      detail: reconciliationResult.review_flags.join(", "),
    });
  }

  if (qualityResult && qualityResult.breakdown.timeliness < 70) {
    low.push({
      title: "Stale record window",
      detail: "Chart timeliness is below threshold, so source freshness should be revalidated.",
    });
  }

  if (!high.length && !medium.length && !low.length) {
    low.push({
      title: "No major risk signals",
      detail: "No elevated medication or data-quality safety concerns were surfaced yet.",
    });
  }

  return [
    { level: "HIGH", items: high },
    { level: "MEDIUM", items: medium },
    { level: "LOW", items: low },
  ];
}

export function RiskHeatmap(props: RiskHeatmapProps) {
  const buckets = buildBuckets(
    props.reconciliationRequest,
    props.reconciliationResult,
    props.qualityRequest,
    props.qualityResult,
  );

  return (
    <section className="panel panel--risk">
      <div className="panel__header panel__header--stacked">
        <div>
          <p className="eyebrow">Clinical Safety</p>
          <h2>Risk heatmap</h2>
        </div>
      </div>

      <div className="heatmap">
        {buckets.map((bucket) => (
          <div className="heatmap__row" key={bucket.level}>
            <div className="heatmap__title">
              <StatusPill tone={bucket.level === "HIGH" ? "danger" : bucket.level === "MEDIUM" ? "warning" : "success"}>
                {bucket.level}
              </StatusPill>
            </div>
            <div className="heatmap__body">
              {bucket.items.length ? (
                bucket.items.map((item) => (
                  <div key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                ))
              ) : (
                <p className="empty-copy">No items.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
