import type { ReconcileMedicationRequest } from "../types";

type MedicationTimelineProps = {
  request: ReconcileMedicationRequest;
};

function sourceDate(source: ReconcileMedicationRequest["sources"][number]) {
  return source.last_updated || source.last_filled || "";
}

export function MedicationTimeline({ request }: MedicationTimelineProps) {
  const events = [...request.sources]
    .sort((left, right) => sourceDate(right).localeCompare(sourceDate(left)))
    .map((source, index) => ({
      system: source.system,
      medication: source.medication,
      date: sourceDate(source) || "Unknown date",
      tone: index === 0 ? "success" : index === 1 ? "warning" : "neutral",
    }));

  return (
    <section className="panel panel--timeline">
      <div className="panel__header panel__header--stacked">
        <div>
          <p className="eyebrow">Medication History</p>
          <h2>Longitudinal source timeline</h2>
        </div>
      </div>

      <div className="timeline-chart">
        {events.map((event) => (
          <div className="timeline-chart__row" key={`${event.system}-${event.date}-${event.medication}`}>
            <div className="timeline-chart__stamp">
              <strong>{event.date}</strong>
            </div>
            <div className={`timeline-chart__dot timeline-chart__dot--${event.tone}`} />
            <div className="timeline-chart__content">
              <strong>{event.system}</strong>
              <p>{event.medication}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
