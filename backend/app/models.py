from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

EMBEDDING_DIM = 512


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(16))


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    file_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    @property
    def image_url(self) -> str:
        return f"/media/{self.file_name}"


class Artwork(Base):
    __tablename__ = "artworks"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    artist: Mapped[str] = mapped_column(Text, default="")
    dating: Mapped[str] = mapped_column(Text, default="")
    technique: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(32))
    dimensions: Mapped[str] = mapped_column(Text, default="")
    story: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16))
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
    loss_result: Mapped[str] = mapped_column(String(16))
    loss_top_similarity: Mapped[float] = mapped_column(Float)
    loss_checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    loss_matches: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PassportEvent(Base):
    __tablename__ = "passport_events"
    __table_args__ = (UniqueConstraint("artwork_id", "seq"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    artwork_id: Mapped[int] = mapped_column(ForeignKey("artworks.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(32))
    occurred_on: Mapped[str] = mapped_column(Text, default="")
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class Auction(Base):
    __tablename__ = "auctions"
    # At most one unfinished auction per artwork, enforced by the database too.
    __table_args__ = (
        Index(
            "uq_auctions_open_per_artwork",
            "artwork_id",
            unique=True,
            postgresql_where=text("status <> 'ended'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    artwork_id: Mapped[int] = mapped_column(ForeignKey("artworks.id"), index=True)
    status: Mapped[str] = mapped_column(String(16))
    start_price: Mapped[int] = mapped_column(Integer)
    min_step: Mapped[int] = mapped_column(Integer)
    current_price: Mapped[int] = mapped_column(Integer)
    bid_count: Mapped[int] = mapped_column(Integer, default=0)
    leader_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[int] = mapped_column(primary_key=True)
    auction_id: Mapped[int] = mapped_column(ForeignKey("auctions.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LostArtwork(Base):
    __tablename__ = "lost_artworks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    artist: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(Text, unique=True)
    image_url: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
