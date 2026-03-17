try:
    from ...ai_engine import generate_clinical_reasoning
except ImportError:
    from backend.ai_engine import generate_clinical_reasoning

__all__ = ["generate_clinical_reasoning"]
