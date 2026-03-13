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

describe("App workflows", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockedReconcileMedication.mockReset();
    mockedValidateDataQuality.mockReset();
  });

  it("renders the hero and both workflows", () => {
    render(<App />);

    expect(screen.getByText("Clinical Data Reconciliation Engine")).toBeInTheDocument();
    expect(screen.getByText("Medication Reconciliation")).toBeInTheDocument();
    expect(screen.getByText("Clinical Data Quality Review")).toBeInTheDocument();
  });

  it("runs medication reconciliation and renders the response", async () => {
    mockedReconcileMedication.mockResolvedValue({
      reconciled_medication: "Lisinopril 10mg daily",
      confidence_score: 0.84,
      reasoning: "Selected the most reliable recent source.",
      recommended_actions: ["Confirm with clinician"],
      clinical_safety_check: "PASSED",
      selected_source_system: "Epic EHR",
      review_flags: [],
      source_rankings: [
        {
          system: "Epic EHR",
          medication: "Lisinopril 10mg daily",
          normalized_medication: "lisinopril",
          score: 90,
          rank: 1,
          reliability: "high",
          freshness_evidence: "2026-03-10",
          review_flags: [],
        },
      ],
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Run Reconciliation" }));

    await waitFor(() => {
      expect(screen.getAllByText("Lisinopril 10mg daily").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Epic EHR")).toBeInTheDocument();
    expect(screen.getByText("Selected the most reliable recent source.")).toBeInTheDocument();
    expect(screen.getByText("Confirm with clinician")).toBeInTheDocument();
  });

  it("runs data-quality validation and renders flagged issues", async () => {
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
        },
      ],
      summary: "Detected 1 issue(s); highest severity is high. Overall data-quality score is 58/100.",
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Validate Data Quality" }));

    await waitFor(() => {
      expect(screen.getByText("Overall score 58")).toBeInTheDocument();
    });
    expect(screen.getByText(/Detected 1 issue/)).toBeInTheDocument();
    expect(screen.getByText("Blood pressure 350/200 is physiologically implausible")).toBeInTheDocument();
  });
});
