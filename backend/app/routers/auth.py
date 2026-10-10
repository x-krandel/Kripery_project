from fastapi import APIRouter, Header, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.deps import CurrentUser, Db
from app.errors import api_error
from app.models import AuthToken, User
from app.schemas import AuthResponse, LoginRequest, RegisterRequest, UserDto
from app.services.auth import (
    MAX_PASSWORD,
    MIN_PASSWORD,
    USERNAME_RE,
    hash_password,
    new_token,
    normalize_username,
    token_hash,
    verify_password,
)
from app.timeutil import utcnow

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue(db: Db, user: User) -> AuthResponse:
    raw, hashed = new_token()
    db.add(AuthToken(token_hash=hashed, user_id=user.id, created_at=utcnow()))
    db.commit()
    return AuthResponse(token=raw, user=UserDto.model_validate(user))


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(db: Db, req: RegisterRequest):
    username = normalize_username(req.username)
    if not USERNAME_RE.match(username):
        raise api_error(400, "INVALID_USERNAME", "Login: 3–32 znaki, małe litery, cyfry oraz . _ -")
    if not MIN_PASSWORD <= len(req.password) <= MAX_PASSWORD:
        raise api_error(400, "WEAK_PASSWORD", f"Hasło musi mieć co najmniej {MIN_PASSWORD} znaków")
    if db.scalar(select(User.id).where(User.username == username)) is not None:
        raise api_error(409, "USERNAME_TAKEN", "Ten login jest już zajęty")
    user = User(name=username, role="collector", username=username, password_hash=hash_password(req.password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:  # two registrations with the same login at once
        db.rollback()
        raise api_error(409, "USERNAME_TAKEN", "Ten login jest już zajęty") from None
    return _issue(db, user)


@router.post("/login", response_model=AuthResponse)
def login(db: Db, req: LoginRequest):
    user = db.scalar(select(User).where(User.username == normalize_username(req.username)))
    if user is None or not verify_password(req.password, user.password_hash):
        raise api_error(401, "INVALID_CREDENTIALS", "Nieprawidłowy login lub hasło")
    return _issue(db, user)


@router.get("/me", response_model=UserDto)
def me(user: CurrentUser):
    return user


@router.post("/logout", status_code=204)
def logout(db: Db, user: CurrentUser, authorization: str | None = Header(default=None)):
    _, _, token = (authorization or "").partition(" ")
    db.execute(delete(AuthToken).where(AuthToken.token_hash == token_hash(token.strip())))
    db.commit()
    return Response(status_code=204)
