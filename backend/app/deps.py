from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import no_user
from app.models import AuthToken, User
from app.services.auth import token_hash

Db = Annotated[Session, Depends(get_db)]
AuthorizationHeader = Annotated[str | None, Header()]


def bearer_token(authorization: str | None) -> str | None:
    """The token from `Authorization: Bearer <token>`, or None."""
    scheme, _, token = (authorization or "").partition(" ")
    token = token.strip()
    return token if scheme.lower() == "bearer" and token else None


def _user_for(db: Session, authorization: str | None) -> User | None:
    token = bearer_token(authorization)
    if token is None:
        return None
    session = db.get(AuthToken, token_hash(token))
    return db.get(User, session.user_id) if session else None


def current_user(db: Db, authorization: AuthorizationHeader = None) -> User:
    """Logged-in user (token from POST /api/auth/login or /register); 401 NO_USER otherwise."""
    user = _user_for(db, authorization)
    if user is None:
        raise no_user()
    return user


def optional_user(db: Db, authorization: AuthorizationHeader = None) -> User | None:
    """Logged-in user or None. Public endpoints use it: a missing or stale token is not an error."""
    return _user_for(db, authorization)


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
