"""Builds contract DTOs from ORM rows."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Artwork, Auction, Bid, PassportEvent, User
from app.schemas import (
    ArtworkDetailDto,
    ArtworkSummaryDto,
    AuctionDetailDto,
    AuctionSummaryDto,
    BidDto,
    LossCheckDto,
    LostArtworkMatchDto,
    PassportDto,
    PassportEventDto,
    UserDto,
)
from app.services.hashing import load_events, verify_chain
from app.timeutil import utcnow

RECENT_BIDS = 10


def open_auctions(db: Session, artwork_ids: list[int]) -> dict[int, Auction]:
    if not artwork_ids:
        return {}
    rows = db.scalars(
        select(Auction).where(Auction.artwork_id.in_(artwork_ids), Auction.status != "ended")
    )
    return {a.artwork_id: a for a in rows}


def artwork_summary(
    artwork: Artwork, events: list[PassportEvent], auction: Auction | None
) -> ArtworkSummaryDto:
    chain = verify_chain(events)
    return ArtworkSummaryDto(
        id=artwork.id,
        title=artwork.title,
        artist=artwork.artist,
        dating=artwork.dating,
        technique=artwork.technique,
        category=artwork.category,
        image_url=artwork.image_url,
        status=artwork.status,
        owner_id=artwork.owner_id,
        verified=chain.chain_valid and artwork.loss_result == "clear",
        auction=AuctionSummaryDto.model_validate(auction) if auction else None,
    )


def artwork_summaries(db: Session, artworks: list[Artwork]) -> list[ArtworkSummaryDto]:
    ids = [a.id for a in artworks]
    events = load_events(db, ids)
    auctions = open_auctions(db, ids)
    return [artwork_summary(a, events[a.id], auctions.get(a.id)) for a in artworks]


def artwork_detail(db: Session, artwork: Artwork) -> ArtworkDetailDto:
    summary = artwork_summaries(db, [artwork])[0]
    owner = db.get(User, artwork.owner_id)
    return ArtworkDetailDto(
        **summary.model_dump(),
        dimensions=artwork.dimensions,
        story=artwork.story,
        owner=UserDto.model_validate(owner),
        loss_check=LossCheckDto(
            result=artwork.loss_result,
            checked_at=artwork.loss_checked_at,
            top_similarity=artwork.loss_top_similarity,
            matches=[LostArtworkMatchDto(**m) for m in artwork.loss_matches],
        ),
    )


def passport(db: Session, artwork: Artwork) -> PassportDto:
    events = load_events(db, [artwork.id])[artwork.id]
    chain = verify_chain(events)
    auction = open_auctions(db, [artwork.id]).get(artwork.id)
    return PassportDto(
        artwork=artwork_summary(artwork, events, auction),
        events=[event_dto(e, chain.valid[e.id]) for e in events],
        chain_valid=chain.chain_valid,
        broken_at_seq=chain.broken_at_seq,
        verified_at=utcnow(),
    )


def event_dto(e: PassportEvent, valid: bool) -> PassportEventDto:
    return PassportEventDto(
        id=e.id,
        seq=e.seq,
        type=e.type,
        occurred_on=e.occurred_on,
        title=e.title,
        description=e.description,
        created_at=e.created_at,
        prev_hash=e.prev_hash,
        hash=e.hash,
        valid=valid,
    )


def bid_dto(bid: Bid, user: User) -> BidDto:
    return BidDto(
        id=bid.id,
        auction_id=bid.auction_id,
        user=UserDto.model_validate(user),
        amount=bid.amount,
        created_at=bid.created_at,
    )


def auction_detail(db: Session, auction: Auction) -> AuctionDetailDto:
    rows = db.execute(
        select(Bid, User)
        .join(User, User.id == Bid.user_id)
        .where(Bid.auction_id == auction.id)
        .order_by(Bid.id.desc())
        .limit(RECENT_BIDS)
    ).all()
    leader = db.get(User, auction.leader_id) if auction.leader_id else None
    return AuctionDetailDto(
        **AuctionSummaryDto.model_validate(auction).model_dump(),
        artwork_id=auction.artwork_id,
        min_step=auction.min_step,
        leader=UserDto.model_validate(leader) if leader else None,
        bids=[bid_dto(b, u) for b, u in rows],
    )
