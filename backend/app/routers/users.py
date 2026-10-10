from fastapi import APIRouter
from sqlalchemy import select

from app.deps import Db
from app.models import User
from app.schemas import UserDto

router = APIRouter(tags=["users"])


@router.get("/users", response_model=list[UserDto])
def list_users(db: Db):
    return db.scalars(select(User).order_by(User.id)).all()
