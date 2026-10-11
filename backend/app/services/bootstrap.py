"""AUTO_SEED=true: make a fresh hosted deployment demo-ready without a shell.

Runs in the background after startup and never deletes anything:
- copies demo and lost images into MEDIA_DIR when they are missing (a database
  seeded from a laptop points at /media files that the server does not have);
- fills lost_artworks from data/lost when the table is empty;
- runs the seed when there are no users yet;
- adds the public-domain gallery (data/gallery) works that are not in the database yet.
"""

import logging
import shutil

from sqlalchemy import func, select

from app.config import settings
from app.db import SessionLocal
from app.models import LostArtwork, User

log = logging.getLogger("rodowod.bootstrap")


def restore_media() -> int:
    copied = 0
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    folders = (
        (settings.data_dir / "demo", "demo_"),
        (settings.data_dir / "lost" / "images", "lost_"),
        (settings.data_dir / "gallery" / "images", "gallery_"),
    )
    for folder, prefix in folders:
        if not folder.is_dir():
            continue
        for src in folder.iterdir():
            dst = settings.media_dir / f"{prefix}{src.name}"
            if src.is_file() and not dst.exists():
                shutil.copyfile(src, dst)
                copied += 1
    return copied


def run() -> None:
    from scripts.index_lost import index
    from scripts.seed import seed
    from scripts.seed_gallery import seed_gallery

    copied = restore_media()
    if copied:
        log.info("restored %d media files from %s", copied, settings.data_dir)
    with SessionLocal() as db:
        lost = db.scalar(select(func.count()).select_from(LostArtwork))
        users = db.scalar(select(func.count()).select_from(User))
    if not lost:
        added, skipped = index()
        log.info("indexed the lost dataset: %d added, %d skipped", added, skipped)
    if not users:
        log.info("seeded: %d auctions", seed())
    if added := seed_gallery():
        log.info("gallery: %d public-domain works added", added)
