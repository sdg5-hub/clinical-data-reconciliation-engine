import type { DataQualityRequest, ReconcileMedicationRequest } from "./types";

export type ImportedPatientPayload = {
  reconciliationRequest: ReconcileMedicationRequest;
  qualityRequest: DataQualityRequest;
  summary: {
    patientName: string;
    sourceType: string;
    medicationCount: number;
    conditionCount: number;
    allergyCount: number;
  };
};

type ResourceLike = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitle(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeGender(value: string | null) {
  if (!value) {
    return "Unknown";
  }
  if (value.length === 1) {
    return value.toUpperCase();
  }
  return toTitle(value);
}

function calculateAgeFromDob(dob: string | null) {
  if (!dob) {
    return 45;
  }

  const birthDate = parseDateString(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return 45;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return Math.max(age, 0);
}

function parseDateString(value: string) {
  const directDate = new Date(value);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  }

  return new Date(Number.NaN);
}

function normalizeIsoDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = parseDateString(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function pickHumanName(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const text = readString(item.text);
    if (text) {
      return text;
    }

    const given = Array.isArray(item.given) ? item.given.map(readString).filter(Boolean) : [];
    const family = readString(item.family);
    const combined = [...given, family].filter(Boolean).join(" ");
    if (combined) {
      return combined;
    }
  }

  return null;
}

function readCodeText(resource: ResourceLike): string | null {
  const code = isRecord(resource.code) ? resource.code : null;
  if (!code) {
    return null;
  }

  const directText = readString(code.text);
  if (directText) {
    return directText;
  }

  if (!Array.isArray(code.coding)) {
    return null;
  }

  for (const coding of code.coding) {
    if (!isRecord(coding)) {
      continue;
    }
    const label = readString(coding.display) || readString(coding.code);
    if (label) {
      return label;
    }
  }

  return null;
}

function readMedicationText(resource: ResourceLike): string | null {
  const concept = isRecord(resource.medicationCodeableConcept) ? resource.medicationCodeableConcept : null;
  if (concept) {
    const text = readString(concept.text);
    if (text) {
      return text;
    }
    if (Array.isArray(concept.coding)) {
      for (const coding of concept.coding) {
        if (!isRecord(coding)) {
          continue;
        }
        const label = readString(coding.display) || readString(coding.code);
        if (label) {
          return label;
        }
      }
    }
  }

  const reference = isRecord(resource.medicationReference) ? resource.medicationReference : null;
  if (reference) {
    return readString(reference.display);
  }

  return null;
}

function resourceSystem(resource: ResourceLike) {
  const meta = isRecord(resource.meta) ? resource.meta : null;
  return readString(meta?.source) || "FHIR Source";
}

function resourceEffectiveDate(resource: ResourceLike) {
  return (
    readString(resource.effectiveDateTime) ||
    readString(resource.authoredOn) ||
    readString(resource.recordedDate) ||
    readString(resource.occurrenceDateTime) ||
    readString(resource.dateRecorded) ||
    isoToday()
  );
}

function normalizeObservationLabel(label: string) {
  return normalizeLabel(label).toLowerCase();
}

function parseBloodPressure(resource: ResourceLike): string | null {
  const directValue = readString(resource.valueString);
  if (directValue) {
    return directValue;
  }

  const quantity = isRecord(resource.valueQuantity) ? resource.valueQuantity : null;
  if (quantity) {
    const value = readNumber(quantity.value);
    const unit = readString(quantity.unit);
    if (value !== null) {
      return unit ? `${value} ${unit}` : String(value);
    }
  }

  if (!Array.isArray(resource.component)) {
    return null;
  }

  let systolic: number | null = null;
  let diastolic: number | null = null;

  for (const component of resource.component) {
    if (!isRecord(component)) {
      continue;
    }
    const label = normalizeObservationLabel(readCodeText(component) || "");
    const quantityValue = isRecord(component.valueQuantity) ? readNumber(component.valueQuantity.value) : null;
    if (quantityValue === null) {
      continue;
    }
    if (label.includes("systolic")) {
      systolic = quantityValue;
    }
    if (label.includes("diastolic")) {
      diastolic = quantityValue;
    }
  }

  return systolic !== null && diastolic !== null ? `${systolic}/${diastolic}` : null;
}

function parseObservationVitalsAndLabs(observations: ResourceLike[]) {
  let bloodPressure: string | undefined;
  let heartRate: number | undefined;
  const labs: Record<string, unknown> = {};

  for (const observation of observations) {
    const rawLabel = readCodeText(observation);
    if (!rawLabel) {
      continue;
    }

    const label = normalizeObservationLabel(rawLabel);
    if (!bloodPressure && label.includes("blood pressure")) {
      bloodPressure = parseBloodPressure(observation) || bloodPressure;
      continue;
    }

    if (!heartRate && (label.includes("heart rate") || label.includes("pulse"))) {
      const quantity = isRecord(observation.valueQuantity) ? observation.valueQuantity : null;
      heartRate = quantity ? readNumber(quantity.value) || heartRate : heartRate;
      continue;
    }

    const quantity = isRecord(observation.valueQuantity) ? observation.valueQuantity : null;
    const quantityValue = quantity ? readNumber(quantity.value) : null;
    const valueString = readString(observation.valueString);
    const valueCodeableConcept = isRecord(observation.valueCodeableConcept) ? observation.valueCodeableConcept : null;
    const codedValue = readString(valueCodeableConcept?.text);
    const labValue = quantityValue ?? valueString ?? codedValue;
    if (labValue !== null && labValue !== undefined) {
      labs[normalizeLabel(rawLabel)] = labValue;
    }
  }

  return {
    bloodPressure,
    heartRate,
    recentLabs: Object.keys(labs).length ? labs : null,
  };
}

function extractResources(input: unknown): { resources: ResourceLike[]; sourceType: string } | null {
  if (Array.isArray(input)) {
    return {
      resources: input.filter(isRecord),
      sourceType: "FHIR resource array",
    };
  }

  if (!isRecord(input)) {
    return null;
  }

  if (readString(input.resourceType) === "Bundle" && Array.isArray(input.entry)) {
    const resources = input.entry
      .map((entry) => (isRecord(entry) && isRecord(entry.resource) ? entry.resource : null))
      .filter((resource): resource is ResourceLike => Boolean(resource));
    return {
      resources,
      sourceType: "FHIR bundle",
    };
  }

  if (readString(input.resourceType)) {
    return {
      resources: [input],
      sourceType: `FHIR ${readString(input.resourceType)}`,
    };
  }

  return null;
}

function buildRequestsFromResources(resources: ResourceLike[], sourceType: string): ImportedPatientPayload {
  const patient = resources.find((resource) => readString(resource.resourceType) === "Patient") || {};
  const conditions = resources
    .filter((resource) => readString(resource.resourceType) === "Condition")
    .map((resource) => readCodeText(resource))
    .filter((item): item is string => Boolean(item));
  const allergies = resources
    .filter((resource) => readString(resource.resourceType) === "AllergyIntolerance")
    .map((resource) => readCodeText(resource))
    .filter((item): item is string => Boolean(item));
  const medications = resources
    .filter((resource) => {
      const resourceType = readString(resource.resourceType);
      return resourceType === "MedicationStatement" || resourceType === "MedicationRequest";
    })
    .map((resource) => ({
      system: resourceSystem(resource),
      medication: readMedicationText(resource) || "Unknown medication",
      last_updated: resourceEffectiveDate(resource),
      source_reliability: "medium",
    }));
  const observations = resources.filter((resource) => readString(resource.resourceType) === "Observation");
  const { bloodPressure, heartRate, recentLabs } = parseObservationVitalsAndLabs(observations);

  const name = pickHumanName(patient.name) || readString(patient.id) || "Imported patient";
  const dob = readString(patient.birthDate) || isoToday();
  const gender = normalizeGender(readString(patient.gender));

  return {
    reconciliationRequest: {
      patient_context: {
        age: calculateAgeFromDob(readString(patient.birthDate)),
        conditions,
        recent_labs: recentLabs,
      },
      sources: medications,
    },
    qualityRequest: {
      demographics: {
        name,
        dob,
        gender,
      },
      medications: medications.map((item) => item.medication),
      allergies,
      conditions,
      vital_signs: {
        blood_pressure: bloodPressure,
        heart_rate: heartRate,
      },
      last_updated: isoToday(),
    },
    summary: {
      patientName: name,
      sourceType,
      medicationCount: medications.length,
      conditionCount: conditions.length,
      allergyCount: allergies.length,
    },
  };
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (!isRecord(item)) {
        return null;
      }
      return readString(item.name) || readString(item.text) || readString(item.label) || readString(item.display);
    })
    .filter((item): item is string => Boolean(item));
}

function firstNonEmptyList(...lists: string[][]): string[] {
  for (const list of lists) {
    if (list.length > 0) {
      return list;
    }
  }
  return [];
}

function readNamedString(source: ResourceLike | null, keys: string[]) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = readString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function readNamedNumber(source: ResourceLike | null, keys: string[]) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const numericValue = readNumber(source[key]);
    if (numericValue !== null) {
      return numericValue;
    }

    const stringValue = readString(source[key]);
    if (stringValue && !Number.isNaN(Number(stringValue))) {
      return Number(stringValue);
    }
  }

  return null;
}

function buildRequestsFromGenericObject(input: ResourceLike): ImportedPatientPayload {
  const demographics = isRecord(input.demographics) ? input.demographics : null;
  const patient = isRecord(input.patient) ? input.patient : null;
  const vitalSigns = isRecord(input.vital_signs) ? input.vital_signs : isRecord(input.vitals) ? input.vitals : null;
  const sources: ReconcileMedicationRequest["sources"] = Array.isArray(input.sources)
    ? input.sources.reduce<ReconcileMedicationRequest["sources"]>((accumulator, source) => {
        if (!isRecord(source)) {
          return accumulator;
        }

        const medication = readString(source.medication) || readString(source.name);
        if (!medication) {
          return accumulator;
        }

        accumulator.push({
          system: readString(source.system) || "Imported JSON",
          medication,
          last_updated: readString(source.last_updated) || readString(source.lastFilled) || isoToday(),
          source_reliability: readString(source.source_reliability) || "medium",
        });
        return accumulator;
      }, [])
    : [];

  const medications = firstNonEmptyList(
    readStringList(input.medications),
    readStringList(patient?.medications),
    readStringList(input.medication_list),
  );
  const conditions = firstNonEmptyList(readStringList(input.conditions), readStringList(patient?.conditions));
  const allergies = firstNonEmptyList(readStringList(input.allergies), readStringList(patient?.allergies));
  const firstName = readNamedString(input, ["Patient_First_Name", "first_name", "First_Name"]);
  const lastName = readNamedString(input, ["Patient_Last_Name", "last_name", "Last_Name"]);
  const combinedExportName = [firstName, lastName].filter(Boolean).join(" ");
  const rawDob =
    readNamedString(demographics, ["dob", "birthDate", "Birth_Date"]) ||
    readNamedString(patient, ["birthDate", "dob", "Birth_Date"]) ||
    readNamedString(input, ["birthDate", "dob", "Birth_Date", "birth_date"]);

  const name =
    readString(demographics?.name) ||
    readString(patient?.name) ||
    readString(input.name) ||
    combinedExportName ||
    "Imported patient";
  const dob =
    normalizeIsoDate(rawDob) ||
    isoToday();
  const gender =
    normalizeGender(
      readNamedString(demographics, ["gender", "Gender"]) ||
        readNamedString(patient, ["gender", "Gender"]) ||
        readNamedString(input, ["gender", "Gender", "sex", "Sex"]),
    );
  const age =
    readNamedNumber(input, ["age", "Age"]) ||
    readNamedNumber(patient, ["age", "Age"]) ||
    calculateAgeFromDob(dob);
  const recentLabs = isRecord(input.recent_labs)
    ? input.recent_labs
    : isRecord(input.recentLabs)
      ? input.recentLabs
      : isRecord(input.labs)
        ? input.labs
        : null;

  const resolvedSources: ReconcileMedicationRequest["sources"] =
    sources.length > 0
      ? sources
      : medications.map((medication) => ({
          system: "Imported JSON",
          medication,
          last_updated: isoToday(),
          source_reliability: "medium",
        }));

  return {
    reconciliationRequest: {
      patient_context: {
        age: age || 45,
        conditions,
        recent_labs: recentLabs,
      },
      sources: resolvedSources,
    },
    qualityRequest: {
      demographics: {
        name,
        dob,
        gender,
      },
      medications: resolvedSources.map((source) => source.medication),
      allergies,
      conditions,
      vital_signs: {
        blood_pressure:
          readString(vitalSigns?.blood_pressure) ||
          readString(vitalSigns?.bloodPressure) ||
          readString(input.blood_pressure) ||
          readString(input.bloodPressure) ||
          undefined,
        heart_rate:
          readNumber(vitalSigns?.heart_rate) ||
          readNumber(vitalSigns?.heartRate) ||
          readNumber(input.heart_rate) ||
          readNumber(input.heartRate) ||
          undefined,
      },
      last_updated: readString(input.last_updated) || isoToday(),
    },
    summary: {
      patientName: name,
      sourceType: "patient JSON object",
      medicationCount: resolvedSources.length,
      conditionCount: conditions.length,
      allergyCount: allergies.length,
    },
  };
}

export function importPatientJson(rawValue: string): ImportedPatientPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("The pasted content is not valid JSON.");
  }

  const resources = extractResources(parsed);
  if (resources) {
    return buildRequestsFromResources(resources.resources, resources.sourceType);
  }

  if (isRecord(parsed)) {
    return buildRequestsFromGenericObject(parsed);
  }

  throw new Error("This JSON shape is not supported yet. Paste a FHIR Bundle, a FHIR resource, or a patient-style JSON object.");
}
