from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.deps import Db
from app.models import LostArtwork
from app.schemas import LostArtworkDto

router = APIRouter(tags=["lost"])


@router.get("/lost", response_model=list[LostArtworkDto])
def list_lost(db: Db, limit: Annotated[int, Query(ge=1, le=500)] = 50):
    return db.scalars(select(LostArtwork).order_by(LostArtwork.id).limit(limit)).all()
