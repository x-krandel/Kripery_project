from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import no_user
from app.models import User

Db = Annotated[Session, Depends(get_db)]


def current_user(db: Db, x_user_id: Annotated[str | None, Header()] = None) -> User:
    try:
        user_id = int(x_user_id or "")
    except ValueError:
        raise no_user() from None
    user = db.get(User, user_id)
    if user is None:
        raise no_user()
    return user


CurrentUser = Annotated[User, Depends(current_user)]
