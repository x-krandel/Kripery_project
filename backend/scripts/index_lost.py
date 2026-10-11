"""data/lost -> lost_artworks.

- lost.csv (title,artist,source_url,image_file), optional rows for works missing
  from the JSONL: images in data/lost/images,
  embedded here and copied to MEDIA_DIR;
- lost_vectors.jsonl (title,artist,source_url,image_url,embedding): precomputed
  clip-ViT-B-32 vectors, loaded as is; image_url stays a remote URL, nothing is downloaded.

Usage: python -m scripts.index_lost [--reset]
Rows whose source_url is already indexed are skipped.
"""

import argparse
import csv
import json
import shutil

from sqlalchemy import delete, select

from app.config import settings
from app.db import SessionLocal, init_db
from app.models import EMBEDDING_DIM, LostArtwork
from app.services import embeddings

# Above this two images show one painting (e.g. the CSV and the JSONL list the same work).
SAME_WORK_SIMILARITY = 0.95


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

        vectors = lost_dir / "lost_vectors.jsonl"
        if vectors.exists():
            with open(vectors, encoding="utf-8") as f:
                for line in f:
                    row = json.loads(line)
                    if row["source_url"] in known:
                        continue
                    if len(row["embedding"]) != EMBEDDING_DIM:
                        print(f"warning: {row['title']!r} has a {len(row['embedding'])}-d vector, row skipped")
                        skipped += 1
                        continue
                    db.flush()
                    distance = LostArtwork.embedding.cosine_distance(row["embedding"])
                    closest = db.execute(select(LostArtwork.title, distance).order_by(distance).limit(1)).first()
                    if closest is not None and 1 - closest[1] >= SAME_WORK_SIMILARITY:
                        print(f"note: {row['title']!r} is already indexed as {closest[0]!r}, row skipped")
                        skipped += 1
                        continue
                    db.add(LostArtwork(
                        title=row["title"], artist=row.get("artist") or "", source_url=row["source_url"],
                        image_url=row["image_url"], embedding=row["embedding"],
                    ))
                    known.add(row["source_url"])
                    added += 1
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
