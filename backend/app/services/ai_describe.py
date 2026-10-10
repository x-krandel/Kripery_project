from pathlib import Path

from pydantic import BaseModel

from app.schemas import AiDescriptionDto, ArtworkCategory

TIMEOUT_SECONDS = 15

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


def describe(image_path: Path) -> AiDescriptionDto:
    # The vision LLM provider is not chosen yet: the endpoint answers
    # AI_UNAVAILABLE and the frontend leaves the form empty, as the contract allows.
    # A client goes here: send image_path as base64 with PROMPT, TIMEOUT_SECONDS,
    # validate the JSON with LlmAnswer and return to_dto(...).
    raise AiUnavailable("vision LLM is not configured")
