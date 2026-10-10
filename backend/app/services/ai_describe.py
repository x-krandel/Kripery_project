import base64
import json
import logging
import os
import urllib.error
import urllib.request
from pathlib import Path

from pydantic import BaseModel, ValidationError

from app.config import settings
from app.schemas import AiDescriptionDto, ArtworkCategory

TIMEOUT_SECONDS = 15

# OpenAI-compatible endpoint. Default: the team's Azure OpenAI resource (v1 API, no api-version needed).
# LLM_MODEL is the *deployment name* in Azure AI Foundry, not necessarily the model name.
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://kripery-project.openai.azure.com/openai/v1").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
CATEGORIES = ("painting", "works_on_paper", "sculpture", "other")

log = logging.getLogger(__name__)

PROMPT = """You are a museum cataloguer. Look at the photo of an artwork and answer ONLY with JSON:
{"title": "...", "artist": "...", "dating": "...", "technique": "...",
 "category": "painting|works_on_paper|sculpture|other", "note": "..." or null}
Write all values in Polish. If you cannot read a signature, set artist to "Autor nieznany"
and explain in note. Never attribute the work to a famous artist without a visible signature."""


class AiUnavailable(Exception):
    pass


class LlmAnswer(BaseModel):
    title: str = ""
    artist: str = ""
    dating: str = ""
    technique: str = ""
    category: ArtworkCategory = "other"
    note: str | None = None


def to_dto(answer: LlmAnswer, raw: dict) -> AiDescriptionDto:
    filled = [f for f in ("title", "artist", "dating", "technique", "category") if str(raw.get(f) or "").strip()]
    return AiDescriptionDto(
        title=answer.title,
        artist=answer.artist,
        dating=answer.dating,
        technique=answer.technique,
        category=answer.category,
        ai_fields=filled,
        note=answer.note,
    )


def _ask_llm(image_path: Path) -> dict:
    image_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    body = {
        "model": LLM_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                # Uploads are stored as JPEG (routers/uploads.py); "low" detail is enough and cheap.
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}", "detail": "low"}},
            ],
        }],
        "response_format": {"type": "json_object"},
        "max_completion_tokens": 400,
    }
    req = urllib.request.Request(
        f"{LLM_BASE_URL}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "api-key": settings.llm_api_key,  # Azure OpenAI
            "Authorization": f"Bearer {settings.llm_api_key}",  # OpenAI-compatible
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
        payload = json.loads(resp.read())
    content = payload["choices"][0]["message"]["content"] or "{}"
    return json.loads(content)


def describe(image_path: Path) -> AiDescriptionDto:
    if not settings.llm_api_key:
        raise AiUnavailable("LLM_API_KEY is not set")
    try:
        raw = _ask_llm(image_path)
        if raw.get("category") not in CATEGORIES:
            raw["category"] = "other"
        answer = LlmAnswer.model_validate(raw)
    except urllib.error.HTTPError as e:
        log.warning("vision LLM HTTP %s: %s", e.code, e.read()[:300])
        raise AiUnavailable(f"HTTP {e.code}") from e
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError, ValidationError) as e:
        log.warning("vision LLM failed: %r", e)
        raise AiUnavailable(str(e)) from e
    return to_dto(answer, raw)
