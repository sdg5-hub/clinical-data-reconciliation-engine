from fastapi import APIRouter

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/demo")
def demo_metadata() -> dict:
    return {
        "mode": "demo",
        "notes": [
            "Mock FHIR ingestion is enabled",
            "Case-based workflows persist to the local database file",
            "Stateless compatibility endpoints remain available",
        ],
    }
