import { useMemo, useState } from "react";
import type { ReviewerActivity } from "../types";
import { StatusPill } from "./StatusPill";

type ActivityTimelineProps = {
  activities: ReviewerActivity[];
};

type ActivityFilter = ReviewerActivity["type"] | "all";

function iconForType(type: ReviewerActivity["type"]) {
  switch (type) {
    case "scanner":
      return "SCAN";
    case "reconciliation":
      return "REC";
    case "quality":
      return "DQ";
    case "review-decision":
      return "REV";
    case "fhir":
      return "FHIR";
    default:
      return "AUD";
  }
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const visibleActivities = useMemo(
    () => (filter === "all" ? activities : activities.filter((activity) => activity.type === filter)),
    [activities, filter],
  );

  return (
    <section className="panel">
      <div className="panel__header panel__header--stacked">
        <div>
          <p className="eyebrow">Audit Log</p>
          <h2>Reviewer and system history</h2>
        </div>
        <div className="button-row button-row--wrap">
          {(["all", "scanner", "reconciliation", "quality", "review-decision", "fhir", "audit"] as ActivityFilter[]).map((item) => (
            <button
              key={item}
              className={`button button--secondary ${filter === item ? "button--active" : ""}`}
              type="button"
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {visibleActivities.length ? (
        <div className="timeline">
          {visibleActivities.map((activity) => (
            <div className="timeline__item" key={activity.id}>
              <div className="timeline__header">
                <strong>{activity.title}</strong>
                <div className="button-row">
                  <span className="timeline__icon">{iconForType(activity.type)}</span>
                  <StatusPill tone={activity.severity}>{activity.type}</StatusPill>
                </div>
              </div>
              <p>{activity.detail}</p>
              <span className="timeline__stamp">{new Date(activity.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-copy">No audit events match the current filter.</p>
      )}
    </section>
  );
}
