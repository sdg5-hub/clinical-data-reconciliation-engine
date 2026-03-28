import { useEffect, useMemo, useRef, useState } from "react";
import { CaseOverview } from "./components/CaseOverview";
import { DataQualityPanel } from "./components/DataQualityPanel";
import { DemoControlPanel } from "./components/DemoControlPanel";
import { DecisionInspector } from "./components/DecisionInspector";
import { MedicationTimeline } from "./components/MedicationTimeline";
import { ReconciliationPanel } from "./components/ReconciliationPanel";
import { RiskHeatmap } from "./components/RiskHeatmap";
import { StatusPill } from "./components/StatusPill";
import {
  demoTwoMedicationRequest,
  demoTwoQualityRequest,
  sampleMedicationRequest,
  sampleQualityRequest,
} from "./sampleData";
import { importPatientJson } from "./patientJson";
import type {
  CaseStatus,
  DataQualityRequest,
  DataQualityResponse,
  ReconcileMedicationRequest,
  ReconcileMedicationResponse,
  ReviewDecision,
} from "./types";

const REPO_PATIENT_JSON_PATH = "/patient-input.json";

function buildStatus(
  reviewDecision: ReviewDecision,
  reconciliationResult: ReconcileMedicationResponse | null,
  qualityResult: DataQualityResponse | null,
): CaseStatus {
  if (reviewDecision === "approved") {
    return "Approved";
  }
  if (reviewDecision === "manual_review") {
    return "Awaiting clinician";
  }
  if (reviewDecision === "rejected") {
    return "Reviewing";
  }
  if (reconciliationResult || qualityResult) {
    return "Reviewing";
  }
  return "Draft";
}

function riskTone(qualityResult: DataQualityResponse | null, reconciliationResult: ReconcileMedicationResponse | null) {
  if (reconciliationResult?.clinical_safety_check === "REQUIRES_REVIEW") {
    return "danger" as const;
  }
  if ((qualityResult?.overall_score ?? 100) < 70) {
    return "warning" as const;
  }
  return "success" as const;
}

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildClinicalFocus(
  activeDemoId: "demo1" | "demo2" | "custom",
  reconciliationResult: ReconcileMedicationResponse | null,
  qualityResult: DataQualityResponse | null,
) {
  if (reconciliationResult?.clinical_safety_check === "PASSED" && (qualityResult?.overall_score ?? 0) >= 80) {
    return {
      tone: "success" as const,
      title: "Stable Recommendation Ready For Review",
      explanation: "The current recommendation looks clinically consistent and the supporting chart quality signals are within a safer range.",
      confidenceLabel: reconciliationResult ? `${Math.round(reconciliationResult.confidence_score * 100)}% confidence` : "High confidence expected",
      nextAction: "Confirm the reasoning trace, then approve if it matches clinical judgment.",
    };
  }

  if (activeDemoId === "demo2") {
    return {
      tone: "neutral" as const,
      title: "Dose Conflict Requires Verification",
      explanation: "Warfarin dosing differs across sources, but the record quality is cleaner. This is a good contrast demo for source ranking and human review.",
      confidenceLabel: reconciliationResult ? `${Math.round(reconciliationResult.confidence_score * 100)}% confidence` : "Moderate confidence expected",
      nextAction: "Run reconciliation and verify why the more recent physician-authored source outranks the portal entry.",
    };
  }

  if (activeDemoId === "custom") {
    return {
      tone: "neutral" as const,
      title: "Custom Patient Case Loaded",
      explanation: "A new patient intake is active. Review the captured medication, then run reconciliation and chart validation to generate a reviewer-ready summary.",
      confidenceLabel: reconciliationResult ? `${Math.round(reconciliationResult.confidence_score * 100)}% confidence` : "Awaiting reconciliation",
      nextAction: "Use the scanner output to confirm the medication list, then run both workflows before making a decision.",
    };
  }

  return {
    tone: "danger" as const,
    title: "Primary Conflict Detected",
    explanation: "Metformin dose sources disagree and the CKD context increases the chance that the older higher dose is unsafe without review.",
    confidenceLabel: reconciliationResult ? `${Math.round(reconciliationResult.confidence_score * 100)}% confidence` : "High-impact conflict case",
    nextAction: "Run reconciliation first, then confirm why primary care outranks hospital and pharmacy records before approving.",
  };
}

export default function App() {
  const [reconciliationRequest, setReconciliationRequest] = useState<ReconcileMedicationRequest>(sampleMedicationRequest);
  const [qualityRequest, setQualityRequest] = useState<DataQualityRequest>(sampleQualityRequest);
  const [reconciliationResult, setReconciliationResult] = useState<ReconcileMedicationResponse | null>(null);
  const [qualityResult, setQualityResult] = useState<DataQualityResponse | null>(null);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>(null);
  const [reviewerRationale, setReviewerRationale] = useState("");
  const [activeDemoId, setActiveDemoId] = useState<"demo1" | "demo2" | "custom">("demo1");
  const repoImportAttempted = useRef(false);
  const status = useMemo(
    () => buildStatus(reviewDecision, reconciliationResult, qualityResult),
    [qualityResult, reconciliationResult, reviewDecision],
  );
  const attentionCount = useMemo(() => {
    const qualitySignals = qualityResult?.issues_detected.length || 0;
    const reconciliationSignals = reconciliationResult?.review_flags.length || 0;
    return qualitySignals + reconciliationSignals;
  }, [qualityResult, reconciliationResult]);
  const clinicalFocus = useMemo(
    () => buildClinicalFocus(activeDemoId, reconciliationResult, qualityResult),
    [activeDemoId, qualityResult, reconciliationResult],
  );

  function resetDemoCase() {
    setReconciliationRequest(sampleMedicationRequest);
    setQualityRequest(sampleQualityRequest);
    setReconciliationResult(null);
    setQualityResult(null);
    setReviewDecision(null);
    setReviewerRationale("");
    setActiveDemoId("demo1");
  }

  async function handleReviewDecision(decision: Exclude<ReviewDecision, null>, _reason?: string) {
    setReviewDecision(decision);
    if (decision === "approved") {
      setReviewerRationale("");
    }
  }

  const scenarios = [
    {
      id: "demo1" as const,
      title: "Demo 1",
      subtitle: "CKD-aware metformin reconciliation with blocking quality defects.",
      reconciliationRequest: sampleMedicationRequest,
      qualityRequest: sampleQualityRequest,
    },
    {
      id: "demo2" as const,
      title: "Demo 2",
      subtitle: "Warfarin source conflict with a cleaner chart for contrast.",
      reconciliationRequest: demoTwoMedicationRequest,
      qualityRequest: demoTwoQualityRequest,
    },
  ];

  function loadScenario(scenario: (typeof scenarios)[number]) {
    setReconciliationRequest(scenario.reconciliationRequest);
    setQualityRequest(scenario.qualityRequest);
    setReconciliationResult(null);
    setQualityResult(null);
    setReviewDecision(null);
    setReviewerRationale("");
    setActiveDemoId(scenario.id);
  }

  function handleCreatePatientCase(payload: {
    reconciliationRequest: ReconcileMedicationRequest;
    qualityRequest: DataQualityRequest;
    pendingScanEvents: unknown[];
  }) {
    setReconciliationRequest(payload.reconciliationRequest);
    setQualityRequest(payload.qualityRequest);
    setReconciliationResult(null);
    setQualityResult(null);
    setReviewDecision(null);
    setReviewerRationale("");
    setActiveDemoId("custom");
  }

  useEffect(() => {
    if (repoImportAttempted.current) {
      return;
    }
    repoImportAttempted.current = true;
    if (import.meta.env.MODE === "test") {
      return;
    }

    async function loadRepoPatientJson() {
      try {
        const repoPatientJsonUrl = new URL(
          `${REPO_PATIENT_JSON_PATH}?t=${Date.now()}`,
          window.location.origin,
        ).toString();
        const response = await fetch(repoPatientJsonUrl);
        if (!response.ok) {
          return;
        }

        const rawText = (await response.text()).trim();
        if (!rawText || rawText === "{}") {
          return;
        }

        const imported = importPatientJson(rawText);
        handleCreatePatientCase({
          reconciliationRequest: imported.reconciliationRequest,
          qualityRequest: imported.qualityRequest,
          pendingScanEvents: [],
        });
      } catch (error) {
        console.error("Could not auto-load repo patient JSON.", error);
      }
    }

    void loadRepoPatientJson();
  }, []);

  return (
    <div className="app-shell">
      <header className="app-hero panel">
        <div className="app-hero__content">
          <div>
            <p className="eyebrow eyebrow--accent">Clinical Data Reconciliation Engine</p>
            <h1>AI-assisted medication reconciliation and chart quality review</h1>
            <p className="workspace-topbar__copy">
              A focused clinical review platform for reconciling conflicting medication records, surfacing chart-quality risks, and keeping the clinician in control of the final decision.
            </p>
            <div className="hero-tags">
              <StatusPill tone="warning">Seeded reviewer case</StatusPill>
              <StatusPill tone="neutral">Conflicting metformin sources</StatusPill>
              <StatusPill tone="danger">CKD safety context</StatusPill>
            </div>
          </div>

          <div className="hero-actions">
            <button className="button" type="button" onClick={() => scrollToSection("reconciliation-section")}>
              Review reconciliation
            </button>
            <button className="button button--secondary" type="button" onClick={() => scrollToSection("data-quality-section")}>
              Review chart quality
            </button>
          </div>
        </div>

        <div className="app-hero__aside">
          <div className="hero-status-card">
            <div className="hero-status-card__row">
              <span>Review state</span>
              <StatusPill tone={riskTone(qualityResult, reconciliationResult)}>
                {qualityResult || reconciliationResult ? "In progress" : "Demo ready"}
              </StatusPill>
            </div>
            <div className="hero-status-card__row">
              <span>Current case</span>
              <StatusPill tone={status === "Approved" ? "success" : status === "Awaiting clinician" ? "warning" : "neutral"}>
                {status}
              </StatusPill>
            </div>
            <div className="hero-status-card__meta">
              <div>
                <span>Open signals</span>
                <strong>{attentionCount}</strong>
              </div>
              <div>
                <span>Active demo</span>
                <strong>{activeDemoId === "custom" ? "New patient" : activeDemoId.toUpperCase()}</strong>
              </div>
            </div>
            <button className="button button--secondary hero-reset" type="button" onClick={resetDemoCase}>
              Reset seeded case
            </button>
          </div>
        </div>
      </header>

      <section className="top-context-grid">
        <article className="context-card context-card--soft">
          <p className="eyebrow">Why This Case</p>
          <h3>One patient, two meaningful reviewer problems</h3>
          <p className="workspace-card__copy">
            The seeded case combines a renal dosing conflict with obvious chart-quality defects so the reasoning, confidence, and safety framing are all easy to demo quickly.
          </p>
        </article>
        <article className="context-card context-card--soft">
          <p className="eyebrow">Fast Demo Path</p>
          <h3>Run the story in under 30 seconds</h3>
          <ol className="demo-list">
            <li>Run reconciliation and point out the selected source, confidence, and rule hits.</li>
            <li>Show the reviewer rationale guard by attempting reject before typing a note.</li>
            <li>Run data quality and open the blocking blood pressure issue.</li>
          </ol>
        </article>
        <article className={`clinical-focus-panel clinical-focus-panel--${clinicalFocus.tone}`}>
          <div className="clinical-focus-panel__accent" />
          <div className="clinical-focus-panel__body">
            <p className="eyebrow">Clinical Focus</p>
            <h3>{clinicalFocus.title}</h3>
            <p className="clinical-focus-panel__copy">{clinicalFocus.explanation}</p>
            <div className="clinical-focus-panel__meta">
              <div className="clinical-focus-panel__metric">
                <span>Confidence indicator</span>
                <strong>{clinicalFocus.confidenceLabel}</strong>
              </div>
              <div className="clinical-focus-panel__metric">
                <span>Open signals</span>
                <strong>{attentionCount}</strong>
              </div>
            </div>
            <div className="clinical-focus-panel__action">
              <span>Next action</span>
              <strong>{clinicalFocus.nextAction}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="demo-script panel panel--subtle">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Demo Script</p>
            <h2>What the reviewer should notice immediately</h2>
          </div>
        </div>
        <div className="demo-script__grid">
          <div className="demo-script__step">
            <span className="demo-script__index">1</span>
            <div>
              <strong>Primary care is the winning source</strong>
              <p>The lower metformin dose is more recent and better fits the CKD context, so the recommendation feels clinically grounded instead of arbitrary.</p>
            </div>
          </div>
          <div className="demo-script__step">
            <span className="demo-script__index">2</span>
            <div>
              <strong>The AI stays explainable</strong>
              <p>Reasoning trace, rule hits, confidence factors, and source ranking are all visible without clicking through extra screens.</p>
            </div>
          </div>
          <div className="demo-script__step">
            <span className="demo-script__index">3</span>
            <div>
              <strong>The reviewer remains in control</strong>
              <p>Reject and manual review require rationale, while data quality clearly separates blocking issues from advisory findings.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="app-grid">
        <main className="app-main">
          <CaseOverview
            reconciliationRequest={reconciliationRequest}
            reconciliationResult={reconciliationResult}
            qualityRequest={qualityRequest}
            qualityResult={qualityResult}
            reviewDecision={reviewDecision}
            status={status}
          />

          <div id="reconciliation-section">
            <ReconciliationPanel
              request={reconciliationRequest}
              result={reconciliationResult}
              onResult={(_request, result) => {
                setReconciliationResult(result);
                setReviewDecision(null);
              }}
            />
          </div>

          <MedicationTimeline request={reconciliationRequest} />

          <div id="data-quality-section">
            <DataQualityPanel
              request={qualityRequest}
              result={qualityResult}
              onResult={(_request, result) => setQualityResult(result)}
            />
          </div>
        </main>

        <aside className="app-rail">
          <DemoControlPanel
            activeDemoId={activeDemoId}
            scenarios={scenarios}
            onLoadScenario={loadScenario}
            onCreateCase={handleCreatePatientCase}
            repoPatientJsonPath={REPO_PATIENT_JSON_PATH}
          />

          <DecisionInspector
            request={reconciliationRequest}
            result={reconciliationResult}
            qualityResult={qualityResult}
            reviewDecision={reviewDecision}
            rationale={reviewerRationale}
            onRationaleChange={setReviewerRationale}
            onReviewDecisionChange={handleReviewDecision}
          />

          <RiskHeatmap
            reconciliationRequest={reconciliationRequest}
            reconciliationResult={reconciliationResult}
            qualityRequest={qualityRequest}
            qualityResult={qualityResult}
          />
        </aside>
      </section>
    </div>
  );
}
