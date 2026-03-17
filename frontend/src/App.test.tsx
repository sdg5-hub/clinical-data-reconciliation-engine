import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./api";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    reconcileMedication: vi.fn(),
    validateDataQuality: vi.fn(),
  };
});

const mockedReconcileMedication = vi.mocked(api.reconcileMedication);
const mockedValidateDataQuality = vi.mocked(api.validateDataQuality);

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockedReconcileMedication.mockReset();
    mockedValidateDataQuality.mockReset();
  });

  it("renders the assignment-focused workflow", () => {
    render(<App />);

    expect(screen.getByText("Clinical Data Reconciliation Engine")).toBeInTheDocument();
    expect(screen.getByText("AI-assisted medication reconciliation and chart quality review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Reconciliation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate Data Quality" })).toBeInTheDocument();
    expect(screen.getByText("AI Decision Inspector")).toBeInTheDocument();
  });

  it("runs medication reconciliation and renders explainability", async () => {
    mockedReconcileMedication.mockResolvedValue({
      reconciled_medication: "Metformin 500mg BID",
      confidence_score: 0.88,
      reasoning: "Primary care record is most recent and aligns better with CKD dosing context.",
      recommended_actions: ["Confirm the active dose with the dispensing pharmacy."],
      clinical_safety_check: "REQUIRES_REVIEW",
      selected_source_system: "Primary care",
      review_flags: ["metformin_with_ckd_context"],
      source_rankings: [
        {
          system: "Primary care",
          medication: "Metformin 500mg BID",
          normalized_medication: "metformin",
          score: 88,
          rank: 1,
          reliability: "high",
          freshness_evidence: "2026-03-12",
          review_flags: [],
        },
      ],
      confidence_breakdown: {
        source_reliability: 0.42,
        recency_weighting: 0.21,
        clinical_plausibility: 0.17,
        fill_verification: 0.08,
        conflict_penalty: -0.1,
      },
      reasoning_trace: [
        { label: "source_reliability", detail: "Primary care outranked the other sources." },
        { label: "clinical_plausibility", detail: "Lower dose better fits the CKD context." },
      ],
      conflict_severity: {
        level: "HIGH",
        explanation: "Renal dosing conflict requires clinical review.",
      },
      what_changed: [],
      rule_hits: ["primary_care_more_recent", "metformin_ckd_dose_review"],
      recommendation_disposition: "requires_review",
      evidence_cards: [
        {
          system: "Primary care",
          reliability: 0.88,
          recency: "2026-03-12",
          safety_notes: ["Renal dosing aligned"],
          conflict_notes: [],
        },
      ],
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Run Reconciliation" }));

    await waitFor(() => {
      expect(screen.getAllByText("Metformin 500mg BID").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Deterministic rule hits")).toBeInTheDocument();
    expect(screen.getByText("Evidence cards")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject Recommendation" })).toBeDisabled();
  });

  it("enables reject after rationale is entered", async () => {
    mockedReconcileMedication.mockResolvedValue({
      reconciled_medication: "Metformin 500mg BID",
      confidence_score: 0.88,
      reasoning: "Primary care record is most recent.",
      recommended_actions: ["Confirm the active dose with the dispensing pharmacy."],
      clinical_safety_check: "REQUIRES_REVIEW",
      selected_source_system: "Primary care",
      review_flags: [],
      source_rankings: [
        {
          system: "Primary care",
          medication: "Metformin 500mg BID",
          normalized_medication: "metformin",
          score: 88,
          rank: 1,
          reliability: "high",
          freshness_evidence: "2026-03-12",
          review_flags: [],
        },
      ],
      rule_hits: [],
      recommendation_disposition: "requires_review",
      evidence_cards: [],
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Run Reconciliation" }));

    await waitFor(() => expect(screen.getByText("Reviewer rationale")).toBeInTheDocument());
    const rationaleField = screen.getByPlaceholderText(/Required for reject and manual review/i);
    await userEvent.type(rationaleField, "Dose conflict unresolved across sources.");
    expect(screen.getByRole("button", { name: "Reject Recommendation" })).toBeEnabled();
  });

  it("runs data quality validation and shows blocking issues", async () => {
    mockedValidateDataQuality.mockResolvedValue({
      overall_score: 58,
      breakdown: {
        completeness: 80,
        accuracy: 65,
        timeliness: 50,
        clinical_plausibility: 37,
      },
      issues_detected: [
        {
          field: "vital_signs.blood_pressure",
          issue: "Blood pressure 350/200 is physiologically implausible",
          severity: "high",
          domain: "plausibility",
          blocking: true,
          remediation: "Confirm the measurement or repeat vitals before clinical action.",
          approval_impact: "blocking",
        },
      ],
      summary: "Detected 1 issue(s); highest severity is high. Overall data-quality score is 58/100.",
      issue_groups: {
        plausibility: [
          {
            field: "vital_signs.blood_pressure",
            issue: "Blood pressure 350/200 is physiologically implausible",
            severity: "high",
            domain: "plausibility",
            blocking: true,
            remediation: "Confirm the measurement or repeat vitals before clinical action.",
            approval_impact: "blocking",
          },
        ],
      },
      recommended_follow_up: ["Validate implausible vital signs or physiologic observations with a clinician."],
      record_freshness: "120 day(s) old",
      field_diagnostics: [
        {
          field: "vital_signs.blood_pressure",
          detail: "Physiologically implausible measurement detected.",
          category: "plausibility",
        },
      ],
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Validate Data Quality" }));

    await waitFor(() => {
      expect(screen.getByText("Blood pressure 350/200 is physiologically implausible")).toBeInTheDocument();
    });
    expect(screen.getAllByText("blocking").length).toBeGreaterThan(0);
    expect(screen.getByText("Confirm the measurement or repeat vitals before clinical action.")).toBeInTheDocument();
  });
});
