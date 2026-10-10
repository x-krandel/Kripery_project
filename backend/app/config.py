import os
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.engine import URL

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    database_url: str
    media_dir: Path
    data_dir: Path
    cors_origins: list[str]
    llm_api_key: str
    loss_match_threshold: float
    duplicate_match_threshold: float


def _database_url() -> str:
    """DB_HOST and friends win over DATABASE_URL.

    Separate parameters are meant for managed servers such as Azure Database for
    PostgreSQL: the password is escaped for the URL and TLS is on by default.
    """
    host = os.getenv("DB_HOST")
    if not host:
        return os.getenv(
            "DATABASE_URL", "postgresql+psycopg://rodowod:rodowod@localhost:5432/rodowod"
        )
    query = {"sslmode": os.getenv("DB_SSLMODE", "require")}
    if root_cert := os.getenv("DB_SSLROOTCERT"):
        query["sslrootcert"] = root_cert
    return URL.create(
        "postgresql+psycopg",
        username=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=host,
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "rodowod"),
        query=query,
    ).render_as_string(hide_password=False)


def _load() -> Settings:
    return Settings(
        database_url=_database_url(),
        media_dir=Path(os.getenv("MEDIA_DIR", "./media")).resolve(),
        data_dir=Path(os.getenv("DATA_DIR", str(REPO_ROOT / "data"))).resolve(),
        cors_origins=[
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if o.strip()
        ],
        llm_api_key=os.getenv("LLM_API_KEY", ""),
        loss_match_threshold=float(os.getenv("LOSS_MATCH_THRESHOLD", "0.85")),
        duplicate_match_threshold=float(os.getenv("DUPLICATE_MATCH_THRESHOLD", "0.92")),
    )


settings = _load()
