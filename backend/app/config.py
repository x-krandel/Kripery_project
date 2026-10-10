import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    database_url: str
    media_dir: Path
    data_dir: Path
    cors_origins: list[str]
    llm_api_key: str
    loss_match_threshold: float


def _load() -> Settings:
    return Settings(
        database_url=os.getenv(
            "DATABASE_URL", "postgresql+psycopg://rodowod:rodowod@localhost:5432/rodowod"
        ),
        media_dir=Path(os.getenv("MEDIA_DIR", "./media")).resolve(),
        data_dir=Path(os.getenv("DATA_DIR", str(REPO_ROOT / "data"))).resolve(),
        cors_origins=[
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if o.strip()
        ],
        llm_api_key=os.getenv("LLM_API_KEY", ""),
        loss_match_threshold=float(os.getenv("LOSS_MATCH_THRESHOLD", "0.85")),
    )


settings = _load()
