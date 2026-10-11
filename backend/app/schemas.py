"""Pydantic mirror of the "DTO contract" section (frontend/src/api/types.ts)."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer
from pydantic.alias_generators import to_camel

from app.timeutil import iso_utc


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# Pydantic would emit microseconds and "+00:00"; the contract wants "2026-10-10T14:32:00Z".
UtcDateTime = Annotated[datetime, PlainSerializer(iso_utc, return_type=str)]

# ===== enums =====
UserRole = Literal["collector", "buyer"]
ArtworkStatus = Literal["published", "held"]
ArtworkCategory = Literal["painting", "works_on_paper", "sculpture", "other"]
PassportEventType = Literal["creation", "exhibition", "conservation", "ownership_change", "registration"]
AuctionStatus = Literal["scheduled", "live", "ended"]
LossCheckResult = Literal["clear", "match"]
AiField = Literal["title", "artist", "dating", "technique", "category"]


# ===== responses =====
class UserDto(CamelModel):
    id: int
    name: str
    role: UserRole


class AuctionSummaryDto(CamelModel):
    id: int
    status: AuctionStatus
    start_price: int
    current_price: int
    bid_count: int
    starts_at: UtcDateTime
    ends_at: UtcDateTime


class ArtworkSummaryDto(CamelModel):
    id: int
    title: str
    artist: str
    dating: str
    technique: str
    category: ArtworkCategory
    image_url: str
    status: ArtworkStatus
    owner_id: int
    verified: bool
    auction: AuctionSummaryDto | None
    # Price of the latest auction (current offer, or the final price once it ended); None if never auctioned.
    last_price: int | None = None


class SimilarArtworkDto(ArtworkSummaryDto):
    similarity: float  # cosine similarity of the CLIP image vectors, 0..1


class LostArtworkMatchDto(CamelModel):
    lost_artwork_id: int
    title: str
    artist: str
    source_url: str
    image_url: str
    similarity: float


class LossCheckDto(CamelModel):
    result: LossCheckResult
    checked_at: UtcDateTime
    top_similarity: float
    matches: list[LostArtworkMatchDto]


class ArtworkDetailDto(ArtworkSummaryDto):
    dimensions: str
    story: str
    owner: UserDto
    loss_check: LossCheckDto


class PassportEventDto(CamelModel):
    id: int
    seq: int
    type: PassportEventType
    occurred_on: str
    title: str
    description: str
    created_at: UtcDateTime
    prev_hash: str
    hash: str
    valid: bool


class PassportDto(CamelModel):
    artwork: ArtworkSummaryDto
    events: list[PassportEventDto]
    chain_valid: bool
    broken_at_seq: int | None
    verified_at: UtcDateTime


class BidDto(CamelModel):
    id: int
    auction_id: int
    user: UserDto
    amount: int
    created_at: UtcDateTime


class AuctionDetailDto(AuctionSummaryDto):
    artwork_id: int
    min_step: int
    leader: UserDto | None
    bids: list[BidDto]


class LostArtworkDto(CamelModel):
    id: int
    title: str
    artist: str
    source_url: str
    image_url: str


PostKind = Literal["offline_auction"]


class PostDto(CamelModel):
    id: int
    kind: PostKind
    author: UserDto
    artwork: ArtworkSummaryDto | None
    title: str
    body: str
    place: str
    starts_at: UtcDateTime | None
    min_price: int | None
    created_at: UtcDateTime


class CreateOfflineAuctionRequest(CamelModel):
    """Invitation to an in-person auction of one of the author's works; published as a post at once."""
    artwork_id: int
    starts_at: datetime
    place: str = Field(min_length=3, max_length=300)
    min_price: int = Field(gt=0)
    body: str = Field(default="", max_length=3000)


class StatsDto(CamelModel):
    """Live numbers for the home page, all counted from the database."""
    artworks: int  # published works with a passport
    passport_entries: int  # entries in the hash chains of published works
    collectors: int  # owners of at least one published work
    auction_volume: int  # sum of the current or final price of auctions with bids, PLN
    lost_indexed: int  # war-loss records the loss check compares against


class UploadDto(CamelModel):
    upload_id: str
    image_url: str


class AiDescriptionDto(CamelModel):
    title: str
    artist: str
    dating: str
    technique: str
    category: ArtworkCategory
    ai_fields: list[AiField]
    note: str | None


# ===== requests =====
class AiDescribeRequest(CamelModel):
    upload_id: str


class NewPassportEventRequest(CamelModel):
    type: Literal["creation", "exhibition", "conservation"]
    occurred_on: str = Field(max_length=100)
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(max_length=5000)


class CreateArtworkRequest(CamelModel):
    upload_id: str
    title: str = Field(min_length=1, max_length=300)
    artist: str = Field(max_length=300)
    dating: str = Field(max_length=100)
    technique: str = Field(max_length=300)
    category: ArtworkCategory
    dimensions: str = Field(max_length=100)
    story: str = Field(max_length=10000)
    history: list[NewPassportEventRequest] = Field(max_length=50)


class CreateAuctionRequest(CamelModel):
    artwork_id: int
    start_price: int = Field(gt=0)
    min_step: int = Field(gt=0)
    duration_minutes: int = Field(ge=1, le=7 * 24 * 60)


class PlaceBidRequest(CamelModel):
    amount: int = Field(gt=0)


# ===== WebSocket: server -> client only =====
class WsSnapshot(CamelModel):
    type: Literal["snapshot"] = "snapshot"
    auction: AuctionDetailDto


class WsBid(CamelModel):
    type: Literal["bid"] = "bid"
    bid: BidDto
    current_price: int
    bid_count: int
    ends_at: UtcDateTime


class WsEnded(CamelModel):
    type: Literal["ended"] = "ended"
    winner: UserDto | None
    final_price: int


class ApiErrorDetail(CamelModel):
    code: str
    message: str


class ApiError(CamelModel):
    detail: ApiErrorDetail


# ===== auth =====
class RegisterRequest(CamelModel):
    username: str
    password: str


class LoginRequest(CamelModel):
    username: str
    password: str


class AuthResponse(CamelModel):
    token: str
    user: UserDto
