import { describe, expect, it } from "vitest";
import { rankedCandidates } from "./MedicationScannerPanel";

describe("MedicationScannerPanel OCR ranking", () => {
  it("matches the pyridoxine packet label from OCR text", () => {
    const candidates = rankedCandidates(
      "PYRIDOXINE HCL VITAMIN B-6 50 mg tablet LOT: 8719109410 EXP: 05/04/2010 MFG: GOLDLINE 001820086014",
    );

    expect(candidates[0]?.label).toBe("Pyridoxine HCL 50mg tablet");
    expect(candidates[0]?.confidence).toBeGreaterThan(0.9);
  });

  it("matches the pyridoxine barcode directly", () => {
    const candidates = rankedCandidates("001820086014");

    expect(candidates[0]?.label).toBe("Pyridoxine HCL 50mg tablet");
    expect(candidates[0]?.confidence).toBeGreaterThan(0.95);
  });
});
