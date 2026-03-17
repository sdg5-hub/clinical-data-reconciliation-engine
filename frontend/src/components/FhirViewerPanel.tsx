import { useMemo, useState } from "react";

type FhirViewerPanelProps = {
  normalizedRecords: Record<string, unknown> | null;
  rawBundle: Record<string, unknown> | null;
  pyhealthPatient: Record<string, unknown> | null;
  onIngestDemo: () => void | Promise<void>;
  isLoading?: boolean;
};

function prettyJson(value: Record<string, unknown> | null) {
  if (!value) {
    return "No FHIR snapshot loaded for this case.";
  }
  return JSON.stringify(value, null, 2);
}

export function FhirViewerPanel({
  normalizedRecords,
  rawBundle,
  pyhealthPatient,
  onIngestDemo,
  isLoading = false,
}: FhirViewerPanelProps) {
  const [mode, setMode] = useState<"normalized" | "raw" | "pyhealth">("normalized");

  const content = useMemo(() => {
    if (mode === "raw") {
      return prettyJson(rawBundle);
    }
    if (mode === "pyhealth") {
      return prettyJson(pyhealthPatient);
    }
    return prettyJson(normalizedRecords);
  }, [mode, normalizedRecords, pyhealthPatient, rawBundle]);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">FHIR Interoperability Layer</p>
          <h2>Raw bundle vs normalized case view</h2>
        </div>
        <div className="button-row">
          <button className="button button--secondary" type="button" onClick={() => setMode("normalized")}>
            Normalized
          </button>
          <button className="button button--secondary" type="button" onClick={() => setMode("raw")}>
            Raw FHIR
          </button>
          <button className="button button--secondary" type="button" onClick={() => setMode("pyhealth")}>
            PyHealth
          </button>
          <button className="button" type="button" onClick={() => void onIngestDemo()} disabled={isLoading}>
            {isLoading ? "Ingesting..." : "Ingest Demo FHIR"}
          </button>
        </div>
      </div>

      <div className="workspace-card workspace-card--muted">
        <div className="workspace-card__header">
          <div>
            <p className="eyebrow">
              {mode === "normalized" ? "Normalized Records" : mode === "raw" ? "Raw Bundle" : "PyHealth Patient"}
            </p>
            <h3>
              {mode === "normalized"
                ? "Case-ready source data"
                : mode === "raw"
                  ? "Mock FHIR payload"
                  : "PyHealth patient, visits, and events"}
            </h3>
          </div>
        </div>
        <pre className="json-viewer">{content}</pre>
      </div>
    </section>
  );
}
