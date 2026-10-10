import os
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.engine import URL

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]
# Azure App Service sets WEBSITE_SITE_NAME. Only /home survives restarts there; the
# app itself may run from a temporary copy, so uploads and the CLIP cache go to /home.
ON_APP_SERVICE = bool(os.getenv("WEBSITE_SITE_NAME"))
if ON_APP_SERVICE:
    os.environ.setdefault("HF_HOME", "/home/hfcache")


@dataclass(frozen=True)
class Settings:
    database_url: str
    media_dir: Path
    data_dir: Path
    cors_origins: list[str]
    llm_api_key: str
    llm_base_url: str
    llm_model: str
    loss_match_threshold: float
    duplicate_match_threshold: float
    auto_seed: bool


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


def _data_dir() -> Path:
    """data/ sits next to backend/ in the repo; the deploy workflow copies it into backend/."""
    if env := os.getenv("DATA_DIR"):
        return Path(env).resolve()
    for candidate in (REPO_ROOT / "data", BACKEND_ROOT / "data"):
        if candidate.is_dir():
            return candidate.resolve()
    return (REPO_ROOT / "data").resolve()


def _load() -> Settings:
    return Settings(
        database_url=_database_url(),
        media_dir=Path(os.getenv("MEDIA_DIR", "/home/media" if ON_APP_SERVICE else "./media")).resolve(),
        data_dir=_data_dir(),
        cors_origins=[
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if o.strip()
        ],
        llm_api_key=os.getenv("LLM_API_KEY", ""),
        # OpenAI-compatible endpoint; default: the team's Azure OpenAI resource (v1 API).
        llm_base_url=os.getenv("LLM_BASE_URL", "https://kripery-project.openai.azure.com/openai/v1").rstrip("/"),
        # Azure: the deployment name from AI Foundry, not necessarily the model name.
        llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        # 0.95: placeholder portraits score ~0.92 against the lost portrait; the lost image itself ~1.0.
        loss_match_threshold=float(os.getenv("LOSS_MATCH_THRESHOLD", "0.95")),
        duplicate_match_threshold=float(os.getenv("DUPLICATE_MATCH_THRESHOLD", "0.92")),
        auto_seed=os.getenv("AUTO_SEED", "").lower() in ("1", "true", "yes"),
    )


settings = _load()
