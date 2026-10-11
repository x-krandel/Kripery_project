"""AUTO_SEED=true: make a fresh hosted deployment demo-ready without a shell.

Runs in the background after startup and never touches users, artworks or bids:
- copies demo and lost images into MEDIA_DIR when they are missing (a database
  seeded from a laptop points at /media files that the server does not have);
- syncs lost_artworks with data/lost (see scripts.index_lost; this part also
  runs without AUTO_SEED);
- runs the seed when there are no users yet.
"""

import logging
import shutil

from sqlalchemy import func, select

from app.config import settings
from app.db import SessionLocal
from app.models import User

log = logging.getLogger("rodowod.bootstrap")


def restore_media() -> int:
    copied = 0
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    for folder, prefix in ((settings.data_dir / "demo", "demo_"), (settings.data_dir / "lost" / "images", "lost_")):
        if not folder.is_dir():
            continue
        for src in folder.iterdir():
            dst = settings.media_dir / f"{prefix}{src.name}"
            if src.is_file() and not dst.exists():
                shutil.copyfile(src, dst)
                copied += 1
    return copied


def sync_lost() -> None:
    from scripts.index_lost import sync

    r = sync()
    log.info("lost dataset synced: %d added, %d updated, %d deleted, %d skipped",
             r.added, r.updated, r.deleted, r.skipped)


def run() -> None:
    from scripts.seed import seed

    copied = restore_media()
    if copied:
        log.info("restored %d media files from %s", copied, settings.data_dir)
    # Before the seed: seeded artworks are checked against the lost dataset.
    sync_lost()
    with SessionLocal() as db:
        users = db.scalar(select(func.count()).select_from(User))
    if not users:
        log.info("seeded: %d auctions", seed())
