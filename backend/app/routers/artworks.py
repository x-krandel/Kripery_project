from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.config import settings
from app.deps import CurrentUser, Db, OptionalUser
from app.errors import NOT_FOUND_ARTWORK, NOT_FOUND_UPLOAD, api_error, not_found, not_owner
from app.models import Artwork, Upload
from app.schemas import (
    ArtworkDetailDto,
    ArtworkSummaryDto,
    CreateArtworkRequest,
    NewPassportEventRequest,
    PassportDto,
    PassportEventDto,
    SimilarArtworkDto,
)
from app.services import embeddings, loss_check, views
from app.services.hashing import append_event, load_events, verify_chain
from app.timeutil import utcnow

router = APIRouter(tags=["artworks"])

# Serializes registrations so two uploads of the same picture cannot both pass
# the duplicate check before either is committed.
REGISTRATION_LOCK_KEY = 7_142_001


def get_artwork(db, artwork_id: int) -> Artwork:
    artwork = db.get(Artwork, artwork_id)
    if artwork is None:
        raise not_found(NOT_FOUND_ARTWORK)
    return artwork


def get_visible_artwork(db, artwork_id: int, user) -> Artwork:
    """A held artwork (possible war-loss match) exists only for its owner: 404 for everyone else."""
    artwork = get_artwork(db, artwork_id)
    if artwork.status == "held" and (user is None or user.id != artwork.owner_id):
        raise not_found(NOT_FOUND_ARTWORK)
    return artwork


@router.get("/artworks", response_model=list[ArtworkSummaryDto])
def list_artworks(db: Db, user: OptionalUser, owner_id: Annotated[int | None, Query(alias="ownerId")] = None):
    query = select(Artwork).order_by(Artwork.id.desc())
    if owner_id is not None:
        query = query.where(Artwork.owner_id == owner_id)
    if owner_id is None or user is None or user.id != owner_id:
        query = query.where(Artwork.status == "published")
    return views.artwork_summaries(db, list(db.scalars(query)))


@router.post("/artworks", response_model=ArtworkDetailDto, status_code=201)
def create_artwork(db: Db, user: CurrentUser, req: CreateArtworkRequest):
    upload = db.get(Upload, req.upload_id)
    if upload is None:
        raise not_found(NOT_FOUND_UPLOAD)

    vec = embeddings.embed_image(settings.media_dir / upload.file_name)
    db.execute(select(func.pg_advisory_xact_lock(REGISTRATION_LOCK_KEY)))
    check = loss_check.check(db, vec)
    # A war-loss match wins over a duplicate: the red screen must show even when the
    # photo also resembles a registered work (CLIP rates similar portraits ~0.92).
    if check.result != "match" and loss_check.find_duplicate(db, vec) is not None:
        raise api_error(409, "ARTWORK_DUPLICATE", "To dzieło jest już zarejestrowane w Rodowodzie")
    now = utcnow()
    artwork = Artwork(
        owner_id=user.id,
        title=req.title.strip(),
        artist=req.artist,
        dating=req.dating,
        technique=req.technique,
        category=req.category,
        dimensions=req.dimensions,
        story=req.story,
        image_url=upload.image_url,
        status="held" if check.result == "match" else "published",
        embedding=vec,
        loss_result=check.result,
        loss_top_similarity=check.top_similarity,
        loss_checked_at=check.checked_at,
        loss_matches=check.matches,
        created_at=now,
    )
    db.add(artwork)
    db.flush()

    for h in req.history:
        append_event(db, artwork.id, h.type, h.occurred_on, h.title, h.description)
    append_event(
        db,
        artwork.id,
        type="registration",
        occurred_on=now.date().isoformat(),
        title=loss_check.REGISTRATION_TITLE,
        description=loss_check.registration_description(check.result),
    )
    db.commit()
    return views.artwork_detail(db, artwork)


@router.get("/artworks/{artwork_id}", response_model=ArtworkDetailDto)
def get_artwork_detail(db: Db, user: OptionalUser, artwork_id: int):
    return views.artwork_detail(db, get_visible_artwork(db, artwork_id, user))


@router.get("/artworks/{artwork_id}/similar", response_model=list[SimilarArtworkDto])
def similar_artworks(db: Db, user: OptionalUser, artwork_id: int, limit: Annotated[int, Query(ge=1, le=12)] = 4):
    """Published works whose CLIP image vector is closest to this one (pgvector cosine distance)."""
    artwork = get_visible_artwork(db, artwork_id, user)
    if artwork.embedding is None:
        return []
    vec = artwork.embedding.tolist() if hasattr(artwork.embedding, "tolist") else list(artwork.embedding)
    distance = Artwork.embedding.cosine_distance(vec)
    rows = db.execute(
        select(Artwork, distance.label("distance"))
        .where(Artwork.id != artwork.id, Artwork.status == "published", Artwork.embedding.is_not(None))
        # distance >= 1 means cosine similarity <= 0: nothing in common, not worth showing
        .where(distance < 1)
        .order_by(distance)
        .limit(limit)
    ).all()
    summaries = views.artwork_summaries(db, [a for a, _ in rows])
    return [
        SimilarArtworkDto(**s.model_dump(), similarity=round(max(0.0, min(1.0, 1 - d)), 4))
        for s, (_, d) in zip(summaries, rows)
    ]


@router.get("/artworks/{artwork_id}/passport", response_model=PassportDto)
def get_passport(db: Db, user: OptionalUser, artwork_id: int):
    return views.passport(db, get_visible_artwork(db, artwork_id, user))


@router.post("/artworks/{artwork_id}/events", response_model=PassportEventDto, status_code=201)
def add_event(db: Db, user: CurrentUser, artwork_id: int, req: NewPassportEventRequest):
    artwork = get_visible_artwork(db, artwork_id, user)
    if artwork.owner_id != user.id:
        raise not_owner()
    event = append_event(db, artwork.id, req.type, req.occurred_on, req.title, req.description)
    db.commit()
    events = load_events(db, [artwork.id])[artwork.id]
    return views.event_dto(event, verify_chain(events).valid[event.id])
