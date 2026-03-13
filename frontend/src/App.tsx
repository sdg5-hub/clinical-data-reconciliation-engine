import { DataQualityPanel } from "./components/DataQualityPanel";
import { ReconciliationPanel } from "./components/ReconciliationPanel";

export default function App() {
  return (
    <div className="shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow eyebrow--accent">Clinical Intelligence Workspace</p>
          <h1>Clinical Data Reconciliation Engine</h1>
          <p className="hero__lede">
            A focused take-home prototype for reconciling conflicting medication records and surfacing clinical
            data quality risks with structured reviewer outputs.
          </p>
        </div>

        <div className="hero__stats">
          <div className="stat-card">
            <span>Backend</span>
            <strong>FastAPI</strong>
          </div>
          <div className="stat-card">
            <span>Frontend</span>
            <strong>React + TypeScript</strong>
          </div>
          <div className="stat-card">
            <span>Purpose</span>
            <strong>EHR review workflows</strong>
          </div>
        </div>
      </header>

      <section className="briefing">
        <div className="briefing__card">
          <p className="eyebrow">Demo Flow</p>
          <ol className="briefing__list">
            <li>Run the seeded medication case to show conflict resolution across sources.</li>
            <li>Review confidence, reasoning, and reviewer action recommendations.</li>
            <li>Run the seeded data-quality case to show stale and implausible clinical data flags.</li>
            <li>Use the JSON editors to demonstrate alternate patient scenarios live.</li>
          </ol>
        </div>
        <div className="briefing__card">
          <p className="eyebrow">Submission Focus</p>
          <p className="briefing__copy">
            This prototype emphasizes explainable workflow outputs, deterministic heuristics, and testable API
            behavior over opaque automation.
          </p>
        </div>
      </section>

      <main className="workspace">
        <ReconciliationPanel />
        <DataQualityPanel />
      </main>
    </div>
  );
}
