from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import Db
from app.models import Artwork, Auction, LostArtwork, PassportEvent
from app.schemas import StatsDto

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=StatsDto)
def stats(db: Db):
    published = Artwork.status == "published"
    return StatsDto(
        artworks=db.scalar(select(func.count()).select_from(Artwork).where(published)),
        passport_entries=db.scalar(
            select(func.count()).select_from(PassportEvent).join(Artwork, Artwork.id == PassportEvent.artwork_id).where(published)
        ),
        collectors=db.scalar(select(func.count(func.distinct(Artwork.owner_id))).where(published)),
        auction_volume=db.scalar(select(func.coalesce(func.sum(Auction.current_price), 0)).where(Auction.bid_count > 0)),
        lost_indexed=db.scalar(select(func.count()).select_from(LostArtwork)),
    )
