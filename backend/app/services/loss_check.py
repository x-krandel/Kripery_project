from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Artwork, LostArtwork
from app.schemas import LostArtworkMatchDto
from app.timeutil import utcnow

TOP_K = 3

REGISTRATION_TITLE = "Dodano do Rodowodu"
_REGISTRATION = "Automatyczne porównanie z bazą strat wojennych MKiDN: "


def registration_description(result: str) -> str:
    """Text of the passport's registration entry for a loss-check result ("clear" or "match")."""
    return _REGISTRATION + ("możliwe dopasowanie, publikacja wstrzymana" if result == "match" else "brak dopasowań")


@dataclass
class LossResult:
    result: str
    top_similarity: float
    checked_at: datetime
    matches: list[dict] = field(default_factory=list)


def check(db: Session, vec: list[float]) -> LossResult:
    distance = LostArtwork.embedding.cosine_distance(vec)
    rows = db.execute(select(LostArtwork, distance.label("distance")).order_by(distance).limit(TOP_K)).all()
    matches = [
        LostArtworkMatchDto(
            lost_artwork_id=lost.id,
            title=lost.title,
            artist=lost.artist,
            source_url=lost.source_url,
            image_url=lost.image_url,
            similarity=round(max(0.0, min(1.0, 1 - dist)), 4),
        ).model_dump()
        for lost, dist in rows
    ]
    top = matches[0]["similarity"] if matches else 0.0
    return LossResult(
        result="match" if top >= settings.loss_match_threshold else "clear",
        top_similarity=top,
        checked_at=utcnow(),
        matches=matches,
    )


def find_duplicate(db: Session, vec: list[float]) -> tuple[int, float] | None:
    """Closest registered artwork if it is at least as similar as the threshold.

    Held artworks are skipped: they never became part of the registry, and the
    red-screen demo has to work for the same lost painting more than once.
    """
    distance = Artwork.embedding.cosine_distance(vec)
    row = db.execute(
        select(Artwork.id, distance.label("distance"))
        .where(Artwork.embedding.is_not(None), Artwork.status != "held")
        .order_by(distance)
        .limit(1)
    ).first()
    if row is None:
        return None
    similarity = 1 - row.distance
    return (row.id, similarity) if similarity >= settings.duplicate_match_threshold else None
