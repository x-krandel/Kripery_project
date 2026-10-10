"""data/lost/lost.csv (title,artist,source_url,image_file) -> lost_artworks.

Usage: python -m scripts.index_lost [--reset]
Rows whose source_url is already indexed are skipped.
"""

import argparse
import csv
import shutil

from sqlalchemy import delete, select

from app.config import settings
from app.db import SessionLocal, init_db
from app.models import LostArtwork
from app.services import embeddings


def index(reset: bool = False) -> tuple[int, int]:
    """Embed data/lost rows into lost_artworks; returns (added, skipped)."""
    lost_dir = settings.data_dir / "lost"
    init_db()
    settings.media_dir.mkdir(parents=True, exist_ok=True)

    with SessionLocal() as db:
        if reset:
            db.execute(delete(LostArtwork))
            db.commit()
        known = set(db.scalars(select(LostArtwork.source_url)))

        added = skipped = 0
        with open(lost_dir / "lost.csv", newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["source_url"] in known:
                    continue
                src = lost_dir / "images" / row["image_file"]
                if not src.exists():
                    print(f"warning: missing image {src}, row skipped")
                    skipped += 1
                    continue
                file_name = f"lost_{row['image_file']}"
                shutil.copyfile(src, settings.media_dir / file_name)
                db.add(LostArtwork(
                    title=row["title"], artist=row.get("artist") or "", source_url=row["source_url"],
                    image_url=f"/media/{file_name}", embedding=embeddings.embed_image(src),
                ))
                known.add(row["source_url"])
                added += 1
                if added % 100 == 0:
                    db.commit()
                    print(f"indexed {added}")
        db.commit()
    return added, skipped


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="clear lost_artworks first")
    args = parser.parse_args()
    added, skipped = index(reset=args.reset)
    print(f"done: {added} added, {skipped} skipped")


if __name__ == "__main__":
    main()
