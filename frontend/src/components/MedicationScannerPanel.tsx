import { useEffect, useRef, useState } from "react";
import type { ScanHistoryItem, ScanSourceType, ScannerCandidate } from "../types";

type MedicationScannerPanelProps = {
  onApplyMedication: (payload: {
    rawValue: string;
    inferredMedication: string;
    codeType: string;
    scanEvent?: ScanHistoryItem;
  }) => void;
};

type BarcodeDetection = {
  rawValue?: string;
  format?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetection[]>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type TextBlock = {
  rawValue?: string;
};

type TextDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<TextBlock[]>;
};

type TextDetectorConstructor = new () => TextDetectorLike;

type ScanResult = {
  rawValue: string;
  codeType: string;
  sourceType: ScanSourceType;
  candidates: ScannerCandidate[];
  confidenceBand: "high" | "medium" | "low";
  requiresConfirmation: boolean;
};

type MedicationCatalogEntry = {
  canonical: string;
  aliases: string[];
  codes: string[];
};

const medicationCatalog: MedicationCatalogEntry[] = [
  {
    canonical: "Metformin 500mg tablet",
    aliases: ["metformin", "metformin 500", "metformin 500mg", "glucophage"],
    codes: ["00069153041", "0069153041"],
  },
  {
    canonical: "Aspirin 81mg daily",
    aliases: ["aspirin", "asa", "aspirin 81", "aspirin 81mg"],
    codes: ["036000291452", "36000291452"],
  },
  {
    canonical: "Lisinopril 10mg daily",
    aliases: ["lisinopril", "lisinopril 10", "lisinopril 10mg"],
    codes: ["00603150058", "603150058"],
  },
  {
    canonical: "Atorvastatin 20mg nightly",
    aliases: ["atorvastatin", "atorvastatin 20", "lipitor"],
    codes: ["00186037231", "186037231"],
  },
  {
    canonical: "Albuterol inhaler PRN",
    aliases: ["albuterol", "albuterol inhaler", "ventolin"],
    codes: ["00378587593", "378587593"],
  },
  {
    canonical: "Pyridoxine HCL 50mg tablet",
    aliases: [
      "pyridoxine",
      "pyridoxine hcl",
      "pyridoxine hydrochloride",
      "vitamin b-6",
      "vitamin b6",
      "vitamin b 6",
    ],
    codes: ["001820086014", "1820086014"],
  },
];

const supportedFormats = [
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "qr_code",
  "data_matrix",
  "pdf417",
] as const;

function getBarcodeDetectorConstructor() {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

function getTextDetectorConstructor() {
  return (window as Window & { TextDetector?: TextDetectorConstructor }).TextDetector;
}

function hasOcrSupport() {
  return Boolean(getTextDetectorConstructor());
}

function normalizeDigitCode(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeScanText(value: string) {
  return value
    .toLowerCase()
    .replace(/[|]/g, "l")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9.\-/\s]/g, " ")
    .replace(/\bvitamin\s+b[\s-]?6\b/g, "vitamin b6")
    .replace(/\bpyridoxine\s+hci\b/g, "pyridoxine hcl")
    .replace(/\btab(?:let)?s?\b/g, "tablet")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDose(rawValue: string) {
  const match = normalizeScanText(rawValue).match(/\b(\d+)\s?(mg|mcg|g|ml)\b/);
  if (!match) {
    return "";
  }
  return `${match[1]}${match[2]}`;
}

function tokenSet(value: string) {
  return new Set(
    normalizeScanText(value)
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function confidenceBand(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.9) {
    return "high";
  }
  if (confidence >= 0.7) {
    return "medium";
  }
  return "low";
}

export function rankedCandidates(rawValue: string): ScannerCandidate[] {
  const trimmed = rawValue.trim();
  const normalized = normalizeScanText(trimmed);
  const digits = normalizeDigitCode(trimmed);
  const dose = extractDose(trimmed);
  const tokens = tokenSet(trimmed);
  const candidates: ScannerCandidate[] = [];

  medicationCatalog.forEach((item) => {
    if (item.codes.includes(trimmed) || (digits && item.codes.includes(digits))) {
      candidates.push({
        label: item.canonical,
        confidence: 0.98,
        reason: "Matched known package or medication code.",
      });
      return;
    }

    const aliasMatch = item.aliases.find((alias) => normalized.includes(normalizeScanText(alias)));
    if (!aliasMatch) {
      return;
    }

    const candidateDose = extractDose(item.canonical);
    const candidateTokens = tokenSet(item.canonical);
    const tokenOverlap = [...candidateTokens].filter((token) => tokens.has(token)).length;
    const tokenBoost = Math.min(0.08, tokenOverlap * 0.02);
    const formBoost = tokens.has("tablet") && candidateTokens.has("tablet") ? 0.03 : 0;
    const doseBoost = dose && candidateDose && dose === candidateDose ? 0.1 : 0;
    const confidence = Math.min(0.97, (dose ? 0.82 : 0.72) + doseBoost + tokenBoost + formBoost);
    candidates.push({
      label: item.canonical,
      confidence,
      reason: doseBoost
        ? `Matched OCR label text "${aliasMatch}", extracted dose ${dose}, and aligned supporting label tokens.`
        : `Matched label text using alias "${aliasMatch}" and supporting label tokens.`,
    });
  });

  if (!candidates.length && digits.length >= 8) {
    candidates.push({
      label: `Medication code ${digits}`,
      confidence: 0.45,
      reason: "Detected a medication-like numeric code but no local catalog match exists.",
    });
  }

  if (!candidates.length && trimmed) {
    candidates.push({
      label: trimmed,
      confidence: dose ? 0.62 : 0.54,
      reason: dose
        ? `Used OCR or manual label text directly after extracting dose ${dose}.`
        : "Used the label text directly because no stronger catalog match was available.",
    });
  }

  return candidates.sort((left, right) => right.confidence - left.confidence);
}

function buildScanResult(rawValue: string, codeType: string, sourceType: ScanSourceType): ScanResult {
  const candidates = rankedCandidates(rawValue);
  const strongest = candidates[0]?.confidence ?? 0;
  return {
    rawValue,
    codeType,
    sourceType,
    candidates,
    confidenceBand: confidenceBand(strongest),
    requiresConfirmation: true,
  };
}

function buildHistoryItem(result: ScanResult, candidate: ScannerCandidate): ScanHistoryItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    rawValue: result.rawValue,
    codeType: result.codeType,
    sourceType: result.sourceType,
    candidates: result.candidates,
    appliedMedication: candidate.label,
    recordedAt: new Date().toISOString(),
    confidenceBand: confidenceBand(candidate.confidence),
  };
}

export function MedicationScannerPanel({ onApplyMedication }: MedicationScannerPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  function clearPollingLoop() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function stopScanning() {
    clearPollingLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }

  function commitCandidate(result: ScanResult, candidate: ScannerCandidate) {
    const historyItem = buildHistoryItem(result, candidate);
    onApplyMedication({
      rawValue: result.rawValue,
      inferredMedication: candidate.label,
      codeType: result.codeType,
      scanEvent: historyItem,
    });
    setScanHistory((current) => [historyItem, ...current].slice(0, 8));
    setScanResult(null);
  }

  async function handleDetected(rawValue: string, codeType: string, sourceType: ScanSourceType) {
    const nextResult = buildScanResult(rawValue, codeType, sourceType);
    setScanResult(nextResult);
    stopScanning();
  }

  async function ensureDetector() {
    const Detector = getBarcodeDetectorConstructor();
    if (!Detector) {
      return null;
    }
    if (!detectorRef.current) {
      detectorRef.current = new Detector({ formats: [...supportedFormats] });
    }
    return detectorRef.current;
  }

  async function detectOcrText(source: ImageBitmapSource): Promise<string | null> {
    const Detector = getTextDetectorConstructor();
    if (!Detector) {
      return null;
    }
    try {
      const detector = new Detector();
      const blocks = await detector.detect(source);
      const text = blocks.map((block) => block.rawValue || "").join(" ").trim();
      return text || null;
    } catch {
      return null;
    }
  }

  async function startScanning() {
    setError(null);

    try {
      const detector = await ensureDetector();
      if (!detector && !hasOcrSupport()) {
        throw new Error("This browser does not support barcode detection or OCR-assisted camera scanning. Use manual entry instead.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsScanning(true);
      clearPollingLoop();
      if (!detector) {
        setError("Live barcode detection is unavailable in this browser. Use Capture Frame for OCR-assisted review.");
        return;
      }
      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current) {
          return;
        }
        try {
          const detections = await detectorRef.current.detect(videoRef.current);
          const hit = detections.find((item) => item.rawValue);
          if (hit?.rawValue) {
            await handleDetected(hit.rawValue, hit.format || "barcode", "live-camera");
          }
        } catch {
          setError("Unable to decode the current frame. Try better lighting or use upload/manual entry.");
        }
      }, 650);
    } catch (scanError) {
      stopScanning();
      setError(scanError instanceof Error ? scanError.message : "Unable to start the medication scanner.");
    }
  }

  async function handleImageScan(file: File) {
    setError(null);
    try {
      const detector = await ensureDetector();
      const image = await createImageBitmap(file);
      if (detector) {
        const detections = await detector.detect(image);
        const hit = detections.find((item) => item.rawValue);
        if (hit?.rawValue) {
          await handleDetected(hit.rawValue, hit.format || "barcode", "uploaded-image");
          image.close();
          return;
        }
      }

      const ocrText = await detectOcrText(image);
      image.close();
      if (!ocrText) {
        setError("No barcode or readable medication label text was detected in the uploaded image.");
        return;
      }
      await handleDetected(ocrText, "ocr-text", "ocr-label");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Unable to decode the uploaded image.");
    }
  }

  async function captureFrame() {
    setError(null);
    if (!videoRef.current) {
      setError("Start the camera scanner before capturing a frame.");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const context = canvas.getContext("2d");
      if (!context) {
        setError("Unable to access the capture canvas.");
        return;
      }
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      if (detectorRef.current) {
        const detections = await detectorRef.current.detect(canvas);
        const hit = detections.find((item) => item.rawValue);
        if (hit?.rawValue) {
          await handleDetected(hit.rawValue, hit.format || "barcode", "captured-frame");
          return;
        }
      }
      const ocrText = await detectOcrText(canvas);
      if (!ocrText) {
        setError("No readable medication code or label text was found in the captured frame.");
        return;
      }
      await handleDetected(ocrText, "ocr-text", "ocr-label");
    } catch {
      setError("The current frame could not be decoded. Try another angle or better lighting.");
    }
  }

  function applyManualValue() {
    const trimmed = manualValue.trim();
    if (!trimmed) {
      return;
    }
    setScanResult(buildScanResult(trimmed, "manual-text", "manual-entry"));
    setManualValue("");
  }

  return (
    <section className="workspace-card workspace-card--muted">
      <div className="workspace-card__header">
        <div>
          <p className="eyebrow">Medication Scanner</p>
          <h3>Camera, image, barcode, and OCR-assisted capture</h3>
          <p className="workspace-card__copy">
            Confirm scanner output before it touches the chart. Barcode detection remains the primary path, with browser OCR as a best-effort fallback for uploaded labels and captured frames.
          </p>
        </div>
        <div className="button-row">
          {isScanning ? (
            <>
              <button className="button button--secondary" type="button" onClick={() => void captureFrame()}>
                Capture Frame
              </button>
              <button className="button button--secondary" type="button" onClick={stopScanning}>
                Stop Scanner
              </button>
            </>
          ) : (
            <button className="button" type="button" onClick={() => void startScanning()}>
              Start Camera Scan
            </button>
          )}
        </div>
      </div>

      <div className="scanner-panel">
        <div className="scanner-panel__preview">
          <video ref={videoRef} className="scanner-panel__video" muted playsInline />
          {!isScanning ? (
            <div className="scanner-panel__overlay">
              Rear camera preview appears here. You can also upload a barcode image or OCR-friendly label photo below.
            </div>
          ) : null}
        </div>

        <div className="scanner-panel__controls">
          <label className="intake-field">
            <span>Manual code or label text</span>
            <input
              placeholder="Enter NDC, UPC, QR payload, or medication label text"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
            />
          </label>

          <label className="intake-field">
            <span>Upload barcode or label image</span>
            <input
              aria-label="Upload barcode image"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImageScan(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>

          <div className="button-row">
            <button className="button button--secondary" type="button" onClick={applyManualValue}>
              Review Manual Value
            </button>
          </div>

          {scanResult ? (
            <div className="scanner-result">
              <strong>Review pending scan</strong>
              <p>Raw value: {scanResult.rawValue}</p>
              <p>Source: {scanResult.sourceType}</p>
              <p>Format: {scanResult.codeType}</p>
              <p>
                Confidence band: <strong>{scanResult.confidenceBand}</strong>
              </p>
              {scanResult.confidenceBand === "low" ? (
                <p className="error">Low-confidence scan. Confirm the medication manually before applying it to the case.</p>
              ) : null}
              <div className="scanner-candidates">
                {scanResult.candidates.map((candidate) => (
                  <button
                    className="scanner-candidate"
                    key={`${candidate.label}-${candidate.reason}`}
                    type="button"
                    onClick={() => commitCandidate(scanResult, candidate)}
                  >
                    <div className="scanner-candidate__header">
                      <strong>{candidate.label}</strong>
                      <span>{Math.round(candidate.confidence * 100)}%</span>
                    </div>
                    <p>{candidate.reason}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty-copy">
              Scan a barcode, upload a medication photo, or enter label text manually. The scanner ranks likely medications and requires explicit confirmation before applying a result.
            </p>
          )}

          {scanHistory.length ? (
            <div className="scanner-history">
              <strong>Recent scan history</strong>
              {scanHistory.map((item) => (
                <div className="scanner-history__item" key={item.id}>
                  <div className="scanner-history__header">
                    <strong>{item.appliedMedication}</strong>
                    <span>{new Date(item.recordedAt).toLocaleTimeString()}</span>
                  </div>
                  <p>
                    {item.sourceType} · {item.codeType}
                  </p>
                  <p>{item.rawValue}</p>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
