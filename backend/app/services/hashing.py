import hashlib
import json
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Artwork, PassportEvent
from app.timeutil import iso_utc, utcnow

GENESIS = "0" * 64


def event_payload(e: PassportEvent) -> dict:
    return {
        "artworkId": e.artwork_id,
        "seq": e.seq,
        "type": e.type,
        "occurredOn": e.occurred_on,
        "title": e.title,
        "description": e.description,
        # iso_utc converts to UTC first: strftime("...Z") on a non-UTC datetime
        # would silently produce a different string and a false broken chain.
        "createdAt": iso_utc(e.created_at),
    }


def compute_hash(prev_hash: str, payload: dict) -> str:
    body = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(f"{prev_hash}|{body}".encode("utf-8")).hexdigest()


def append_event(
    db: Session,
    artwork_id: int,
    type: str,
    occurred_on: str,
    title: str,
    description: str,
) -> PassportEvent:
    """Append an event to the artwork's chain. The caller commits.

    Locks the artwork row so two concurrent appends cannot read the same last
    seq and collide on (artwork_id, seq).
    """
    db.execute(select(Artwork.id).where(Artwork.id == artwork_id).with_for_update())
    last = db.execute(
        select(PassportEvent.seq, PassportEvent.hash)
        .where(PassportEvent.artwork_id == artwork_id)
        .order_by(PassportEvent.seq.desc())
        .limit(1)
    ).first()
    seq, prev_hash = (last.seq + 1, last.hash) if last else (1, GENESIS)

    event = PassportEvent(
        artwork_id=artwork_id,
        seq=seq,
        type=type,
        occurred_on=occurred_on,
        title=title,
        description=description,
        created_at=utcnow(),
        prev_hash=prev_hash,
    )
    event.hash = compute_hash(prev_hash, event_payload(event))
    db.add(event)
    db.flush()
    return event


@dataclass
class ChainCheck:
    valid: dict[int, bool]  # event id -> valid
    chain_valid: bool
    broken_at_seq: int | None


def verify_chain(events: list[PassportEvent]) -> ChainCheck:
    """Events must be ordered by seq."""
    valid: dict[int, bool] = {}
    broken_at: int | None = None
    prev_hash = GENESIS
    for e in events:
        ok = e.prev_hash == prev_hash and compute_hash(e.prev_hash, event_payload(e)) == e.hash
        valid[e.id] = ok
        if not ok and broken_at is None:
            broken_at = e.seq
        prev_hash = e.hash
    return ChainCheck(valid=valid, chain_valid=broken_at is None, broken_at_seq=broken_at)


def load_events(db: Session, artwork_ids: list[int]) -> dict[int, list[PassportEvent]]:
    by_artwork: dict[int, list[PassportEvent]] = {a: [] for a in artwork_ids}
    if not artwork_ids:
        return by_artwork
    rows = db.scalars(
        select(PassportEvent)
        .where(PassportEvent.artwork_id.in_(artwork_ids))
        .order_by(PassportEvent.artwork_id, PassportEvent.seq)
    )
    for e in rows:
        by_artwork[e.artwork_id].append(e)
    return by_artwork

