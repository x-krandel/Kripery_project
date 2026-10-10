from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import no_user
from app.models import AuthToken, User
from app.services.auth import token_hash

Db = Annotated[Session, Depends(get_db)]


def current_user(db: Db, authorization: Annotated[str | None, Header()] = None) -> User:
    """`Authorization: Bearer <token>` from POST /api/auth/login or /register."""
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise no_user()
    session = db.get(AuthToken, token_hash(token.strip()))
    user = db.get(User, session.user_id) if session else None
    if user is None:
        raise no_user()
    return user


CurrentUser = Annotated[User, Depends(current_user)]
