import type { DataQualityResponse, ReconcileMedicationResponse, ReviewDecision } from "../types";
import { StatusPill } from "./StatusPill";

type Reminder = {
  label: string;
  due: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

type ReviewCalendarProps = {
  reconciliationResult: ReconcileMedicationResponse | null;
  qualityResult: DataQualityResponse | null;
  reviewDecision: ReviewDecision;
};

function nextDateLabel(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildReminders(
  reconciliationResult: ReconcileMedicationResponse | null,
  qualityResult: DataQualityResponse | null,
  reviewDecision: ReviewDecision,
): Reminder[] {
  const reminders: Reminder[] = [];

  if (reconciliationResult?.clinical_safety_check === "REQUIRES_REVIEW") {
    reminders.push({
      label: "Escalate medication review",
      due: `Today · ${nextDateLabel(0)}`,
      detail: "Route the reconciled medication recommendation to a clinician or pharmacist for sign-off.",
      tone: "danger",
    });
  }

  if (qualityResult && qualityResult.overall_score < 70) {
    reminders.push({
      label: "Request chart correction",
      due: `24h · ${nextDateLabel(1)}`,
      detail: "Follow up on the low-scoring record and confirm allergies, vitals, and update recency.",
      tone: "warning",
    });
  }

  if (reviewDecision === "rejected") {
    reminders.push({
      label: "Open secondary review",
      due: `48h · ${nextDateLabel(2)}`,
      detail: "A reviewer rejected the current suggestion. Queue a secondary reconciliation pass.",
      tone: "warning",
    });
  }

  if (reviewDecision === "approved") {
    reminders.push({
      label: "Document accepted recommendation",
      due: `72h · ${nextDateLabel(3)}`,
      detail: "Record the approved suggestion and notify downstream care coordination if needed.",
      tone: "success",
    });
  }

  if (!reminders.length) {
    reminders.push({
      label: "No follow-up reminders yet",
      due: `Standby · ${nextDateLabel(0)}`,
      detail: "Run the workflows or record a reviewer decision to generate follow-up tasks.",
      tone: "neutral",
    });
  }

  return reminders;
}

export function ReviewCalendar({ reconciliationResult, qualityResult, reviewDecision }: ReviewCalendarProps) {
  const reminders = buildReminders(reconciliationResult, qualityResult, reviewDecision);

  return (
    <section className="workspace-grid workspace-grid--two">
      <div className="workspace-card">
        <div className="workspace-card__header">
          <div>
            <p className="eyebrow">Follow-Up Calendar</p>
            <h2>Reviewer reminders and next actions</h2>
          </div>
        </div>
        <div className="calendar-list">
          {reminders.map((reminder) => (
            <div className="calendar-item" key={`${reminder.label}-${reminder.due}`}>
              <div className="calendar-item__header">
                <strong>{reminder.label}</strong>
                <StatusPill tone={reminder.tone}>{reminder.due}</StatusPill>
              </div>
              <p>{reminder.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
