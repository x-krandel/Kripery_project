import asyncio
import logging
from dataclasses import dataclass
from datetime import timedelta

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.errors import NOT_FOUND_ARTWORK, NOT_FOUND_AUCTION, api_error, format_pln, not_found, not_owner
from app.models import Artwork, Auction, Bid, User
from app.schemas import UserDto, WsBid, WsEnded
from app.services import views
from app.services.hashing import append_event
from app.services.ws_hub import hub
from app.timeutil import utcnow

log = logging.getLogger(__name__)

ANTI_SNIPE_WINDOW = timedelta(seconds=30)
TICK_SECONDS = 1


def create_auction(db: Session, user: User, artwork_id: int, start_price: int, min_step: int, duration_minutes: int) -> Auction:
    artwork = db.scalar(select(Artwork).where(Artwork.id == artwork_id).with_for_update())
    if artwork is None:
        raise not_found(NOT_FOUND_ARTWORK)
    if artwork.owner_id != user.id:
        raise not_owner()
    if artwork.status == "held":
        raise api_error(409, "ARTWORK_HELD", "Publikacja dzieła jest wstrzymana, nie można wystawić go na aukcję")
    auction_exists = api_error(409, "AUCTION_EXISTS", "To dzieło ma już trwającą aukcję")
    if views.open_auctions(db, [artwork.id]):
        raise auction_exists

    now = utcnow()
    auction = Auction(
        artwork_id=artwork.id,
        status="live",
        start_price=start_price,
        min_step=min_step,
        current_price=start_price,
        bid_count=0,
        starts_at=now,
        ends_at=now + timedelta(minutes=duration_minutes),
        created_at=now,
    )
    db.add(auction)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise auction_exists
    return auction


def place_bid(db: Session, user: User, auction_id: int, amount: int) -> WsBid:
    """Validates and stores a bid under a row lock; returns the message to broadcast."""
    auction = db.scalar(select(Auction).where(Auction.id == auction_id).with_for_update())
    if auction is None:
        raise not_found(NOT_FOUND_AUCTION)

    # Decided by the clock, not only by status: the background loop may lag up
    # to a tick behind starts_at / ends_at.
    now = utcnow()
    if auction.status == "ended" or now >= auction.ends_at:
        raise api_error(409, "AUCTION_NOT_LIVE", "Aukcja już się zakończyła")
    if now < auction.starts_at:
        raise api_error(409, "AUCTION_NOT_LIVE", "Aukcja jeszcze się nie rozpoczęła")

    owner_id = db.scalar(select(Artwork.owner_id).where(Artwork.id == auction.artwork_id))
    if owner_id == user.id:
        raise api_error(403, "OWN_AUCTION", "Nie możesz licytować własnego dzieła")

    minimum = auction.start_price if auction.bid_count == 0 else auction.current_price + auction.min_step
    if amount < minimum:
        raise api_error(409, "BID_TOO_LOW", f"Minimalna oferta to {format_pln(minimum)}")

    bid = Bid(auction_id=auction.id, user_id=user.id, amount=amount, created_at=now)
    db.add(bid)
    auction.status = "live"
    auction.current_price = amount
    auction.leader_id = user.id
    auction.bid_count += 1
    if auction.ends_at - now < ANTI_SNIPE_WINDOW:
        auction.ends_at += ANTI_SNIPE_WINDOW
    db.commit()

    return WsBid(
        bid=views.bid_dto(bid, user),
        current_price=auction.current_price,
        bid_count=auction.bid_count,
        ends_at=auction.ends_at,
    )


def _finish(db: Session, auction_id: int) -> tuple[int, WsEnded] | None:
    auction = db.scalar(select(Auction).where(Auction.id == auction_id).with_for_update())
    # Re-checked under the lock: a last-second bid may have pushed ends_at forward.
    if auction is None or auction.status == "ended" or utcnow() < auction.ends_at:
        db.rollback()
        return None

    auction.status = "ended"
    winner = db.get(User, auction.leader_id) if auction.leader_id else None
    if winner is not None:
        artwork = db.scalar(select(Artwork).where(Artwork.id == auction.artwork_id).with_for_update())
        artwork.owner_id = winner.id
        append_event(
            db,
            artwork.id,
            type="ownership_change",
            occurred_on=utcnow().date().isoformat(),
            title="Zmiana właściciela",
            description="Sprzedaż na aukcji Rodowód",
        )
    db.commit()
    return auction.id, WsEnded(
        winner=UserDto.model_validate(winner) if winner else None,
        final_price=auction.current_price,
    )


def tick() -> list[tuple[int, WsEnded]]:
    now = utcnow()
    ended: list[tuple[int, WsEnded]] = []
    with SessionLocal() as db:
        db.execute(
            update(Auction)
            .where(Auction.status == "scheduled", Auction.starts_at <= now, Auction.ends_at > now)
            .values(status="live")
        )
        db.commit()
        due = db.scalars(select(Auction.id).where(Auction.status != "ended", Auction.ends_at <= now)).all()
        for auction_id in due:
            try:
                result = _finish(db, auction_id)
            except Exception:
                db.rollback()
                log.exception("failed to finish auction %s", auction_id)
                continue
            if result is not None:
                ended.append(result)
    return ended


async def run_loop() -> None:
    while True:
        try:
            for auction_id, message in await run_in_threadpool(tick):
                await hub.broadcast(auction_id, message.model_dump(mode="json", by_alias=True))
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("auction loop tick failed")
        await asyncio.sleep(TICK_SECONDS)
