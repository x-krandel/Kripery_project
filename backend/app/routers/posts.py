from datetime import timezone
from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlalchemy import or_, select

from app.deps import CurrentUser, Db, OptionalUser
from app.errors import api_error, not_found, not_owner
from app.models import Artwork, Post, User
from app.routers.artworks import get_visible_artwork
from app.schemas import CreateOfflineAuctionRequest, PostDto, UserDto
from app.services import views
from app.timeutil import utcnow

router = APIRouter(tags=["posts"])


def post_dtos(db, posts: list[Post]) -> list[PostDto]:
    artworks = {a.id: a for a in db.scalars(select(Artwork).where(Artwork.id.in_({p.artwork_id for p in posts if p.artwork_id})))}
    summaries = {s.id: s for s in views.artwork_summaries(db, list(artworks.values()))}
    authors = {u.id: u for u in db.scalars(select(User).where(User.id.in_({p.author_id for p in posts})))}
    return [
        PostDto(
            id=p.id, kind=p.kind, author=UserDto.model_validate(authors[p.author_id]),
            artwork=summaries.get(p.artwork_id) if p.artwork_id else None,
            title=p.title, body=p.body, place=p.place, starts_at=p.starts_at, min_price=p.min_price,
            created_at=p.created_at,
        )
        for p in posts
    ]


@router.get("/posts", response_model=list[PostDto])
def list_posts(
    db: Db,
    user: OptionalUser,
    author_id: Annotated[int | None, Query(alias="authorId")] = None,
    artwork_id: Annotated[int | None, Query(alias="artworkId")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
):
    query = select(Post).outerjoin(Artwork, Artwork.id == Post.artwork_id).order_by(Post.created_at.desc(), Post.id.desc())
    if author_id is not None:
        query = query.where(Post.author_id == author_id)
    if artwork_id is not None:
        query = query.where(Post.artwork_id == artwork_id)
    # A post about a held artwork is as invisible as the artwork itself.
    visible = or_(Post.artwork_id.is_(None), Artwork.status == "published")
    if user is not None:
        visible = or_(visible, Post.author_id == user.id)
    return post_dtos(db, list(db.scalars(query.where(visible).limit(limit))))


@router.post("/posts/offline-auction", response_model=PostDto, status_code=201)
def create_offline_auction(db: Db, user: CurrentUser, req: CreateOfflineAuctionRequest):
    artwork = get_visible_artwork(db, req.artwork_id, user)
    if artwork.owner_id != user.id:
        raise not_owner()
    if artwork.status == "held":
        raise api_error(409, "ARTWORK_HELD", "Publikacja dzieła jest wstrzymana, nie można wystawić go na aukcję")
    starts_at = req.starts_at if req.starts_at.tzinfo else req.starts_at.replace(tzinfo=timezone.utc)
    if starts_at <= utcnow():
        raise api_error(400, "INVALID_DATE", "Termin aukcji musi być w przyszłości")
    post = Post(
        author_id=user.id, artwork_id=artwork.id, kind="offline_auction",
        title=f"Aukcja stacjonarna: {artwork.title}", body=req.body.strip(), place=req.place.strip(),
        starts_at=starts_at.replace(microsecond=0), min_price=req.min_price, created_at=utcnow(),
    )
    db.add(post)
    db.commit()
    return post_dtos(db, [post])[0]


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(db: Db, user: CurrentUser, post_id: int):
    post = db.get(Post, post_id)
    if post is None:
        raise not_found("Nie znaleziono posta")
    if post.author_id != user.id:
        raise api_error(403, "NOT_AUTHOR", "To nie jest Twój post")
    db.delete(post)
    db.commit()
    return Response(status_code=204)
