from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

# Session time zone is pinned to UTC so timestamptz values come back in UTC
# regardless of the server default; passport hashes depend on it.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    # Managed servers and their load balancers drop idle connections.
    pool_recycle=1800,
    connect_args={"options": "-c timezone=UTC"},
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


def init_db() -> None:
    from app import models

    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    models.Base.metadata.create_all(engine)
    # Databases created before login existed: add the columns and the unique index in place.
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(32)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(200)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
