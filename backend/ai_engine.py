from __future__ import annotations

import hashlib
import json
from typing import Dict

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI, RateLimitError

from .config import get_settings

_CACHE: Dict[str, str] = {}


def _prompt_cache_key(system_prompt: str, user_prompt: str, model: str) -> str:
    digest = hashlib.sha256()
    digest.update(system_prompt.encode("utf-8"))
    digest.update(user_prompt.encode("utf-8"))
    digest.update(model.encode("utf-8"))
    return digest.hexdigest()


def _is_configured(api_key: str) -> bool:
    return bool(api_key) and api_key.strip() not in {"", "sk-"}


def generate_clinical_reasoning(system_prompt: str, user_payload: dict, fallback: str) -> str:
    settings = get_settings()
    if not _is_configured(settings.openai_api_key):
        return fallback

    user_prompt = json.dumps(user_payload, indent=2, sort_keys=True)
    cache_key = _prompt_cache_key(system_prompt, user_prompt, settings.openai_model)
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    client = OpenAI(api_key=settings.openai_api_key)

    try:
        response = client.responses.create(
            model=settings.openai_model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        text = getattr(response, "output_text", "").strip()
        if not text:
            return fallback
        _CACHE[cache_key] = text
        return text
    except (RateLimitError, APIConnectionError, APITimeoutError, APIStatusError):
        return fallback
    except Exception:
        return fallback
