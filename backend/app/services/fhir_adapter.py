from collections import defaultdict


def normalize_bundle(bundle: dict) -> dict:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for entry in bundle.get("entry", []):
        resource = entry.get("resource", {})
        resource_type = resource.get("resourceType", "Unknown")
        grouped[resource_type].append(resource)

    patient = grouped.get("Patient", [{}])[0]
    observations = grouped.get("Observation", [])
    statements = grouped.get("MedicationStatement", []) + grouped.get("MedicationRequest", [])

    medications = []
    for resource in statements:
        medication = (
            resource.get("medicationCodeableConcept", {})
            .get("text")
            or resource.get("medicationReference", {}).get("display")
            or "Unknown medication"
        )
        medications.append(
            {
                "system": resource.get("meta", {}).get("source", "FHIR Source"),
                "medication": medication,
                "status": resource.get("status", "unknown"),
                "effective": resource.get("effectiveDateTime") or resource.get("authoredOn"),
            }
        )

    return {
        "patient": {
            "name": patient.get("name", [{}])[0].get("text", "Unknown patient"),
            "gender": patient.get("gender", "unknown"),
            "birthDate": patient.get("birthDate"),
        },
        "conditions": [item.get("code", {}).get("text", "Unknown condition") for item in grouped.get("Condition", [])],
        "allergies": [item.get("code", {}).get("text", "Unknown allergy") for item in grouped.get("AllergyIntolerance", [])],
        "medications": medications,
        "observations": [
            {
                "name": item.get("code", {}).get("text", "Unknown observation"),
                "value": item.get("valueString")
                or item.get("valueQuantity", {}).get("value")
                or item.get("valueCodeableConcept", {}).get("text"),
            }
            for item in observations
        ],
        "encounters": [
            {
                "status": item.get("status", "unknown"),
                "period": item.get("period", {}),
            }
            for item in grouped.get("Encounter", [])
        ],
    }
