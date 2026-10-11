import base64
import json
import logging
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import get_args

from pydantic import BaseModel, ValidationError, field_validator

from app.config import settings
from app.schemas import AiDescriptionDto, ArtworkCategory

TIMEOUT_SECONDS = 30
# Generous: reasoning models (and Gemini 3) spend part of the budget on thinking before the JSON.
MAX_TOKENS = 1500

CATEGORIES = get_args(ArtworkCategory)

log = logging.getLogger(__name__)

PROMPT = """You are a museum cataloguer. Look at the photo of an artwork and answer ONLY with one JSON object:
{"title": "...", "artist": "...", "dating": "...", "technique": "...",
 "category": "painting|works_on_paper|sculpture|other", "note": "..." or null}
Rules for "artist", in this order:
1. If you recognise this specific, known artwork (for example a famous painting or one from a museum
   collection), give its author's full name and its usual title, and say in "note" that it is an AI
   recognition the owner should verify.
2. Else, if a signature is legible, give the name from the signature.
3. Else, give the most likely attribution in Polish auction-catalogue style, such as "Szkoła polska",
   "Krąg Jana Matejki" or "Malarz nieznany", and explain in "note" why.
Never leave "artist" empty and never use null for any text field. Write all values in Polish."""


class AiUnavailable(Exception):
    pass


class LlmAnswer(BaseModel):
    title: str = ""
    artist: str = ""
    dating: str = ""
    technique: str = ""
    category: ArtworkCategory = "other"
    note: str | None = None

    @field_validator("title", "artist", "dating", "technique", mode="before")
    @classmethod
    def _text(cls, v):
        # Models sometimes send null or a number ("dating": 1895) for a text field.
        return "" if v is None else str(v).strip()


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


def _post(body: dict) -> dict:
    req = urllib.request.Request(
        f"{settings.llm_base_url}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "api-key": settings.llm_api_key,  # Azure OpenAI
            "Authorization": f"Bearer {settings.llm_api_key}",  # OpenAI, Gemini and other OpenAI-compatible APIs
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
        return json.loads(resp.read())


def parse_json_answer(content: str | None) -> dict:
    """The JSON object in a model answer, also when it comes wrapped in ```json fences or prose."""
    text = (content or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except ValueError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _ask_llm(image_path: Path) -> dict:
    image_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    image_url = f"data:image/jpeg;base64,{image_b64}"  # uploads are stored as JPEG (routers/uploads.py)
    body = {
        "model": settings.llm_model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                # "low" detail is enough for cataloguing and cheap.
                {"type": "image_url", "image_url": {"url": image_url, "detail": "low"}},
            ],
        }],
        "response_format": {"type": "json_object"},
        "max_completion_tokens": MAX_TOKENS,
    }
    try:
        payload = _post(body)
    except urllib.error.HTTPError as e:
        if e.code != 400:
            raise
        # Some OpenAI-compatible providers reject newer fields (JSON mode, max_completion_tokens,
        # image detail). Retry once with the plainest request; the prompt still asks for JSON only.
        log.info("vision LLM rejected the request (%s), retrying without optional fields: %s", e.code, e.read()[:300])
        payload = _post({
            "model": settings.llm_model,
            "messages": [{
                "role": "user",
                "content": [{"type": "text", "text": PROMPT}, {"type": "image_url", "image_url": {"url": image_url}}],
            }],
            "max_tokens": MAX_TOKENS,
        })
    return parse_json_answer(payload["choices"][0]["message"]["content"])


def describe(image_path: Path) -> AiDescriptionDto:
    if not settings.llm_api_key:
        raise AiUnavailable("LLM_API_KEY is not set")
    try:
        raw = _ask_llm(image_path)
        if not raw.get("artist") and raw.get("author"):
            raw["artist"] = raw["author"]  # some models rename the key
        if raw.get("category") not in CATEGORIES:
            # Not a value the model gave us: use "other" and keep it out of aiFields.
            raw["category"] = None
        answer = LlmAnswer.model_validate({**raw, "category": raw["category"] or "other"})
    except urllib.error.HTTPError as e:
        log.warning("vision LLM HTTP %s: %s", e.code, e.read()[:300])
        raise AiUnavailable(f"HTTP {e.code}") from e
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError, ValidationError) as e:
        log.warning("vision LLM failed: %r", e)
        raise AiUnavailable(str(e)) from e
    return to_dto(answer, raw)
