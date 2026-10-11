"""data/lost -> lost_artworks.

- lost.csv (title,artist,source_url,image_file), optional rows for works missing
  from the JSONL: images in data/lost/images,
  embedded here and copied to MEDIA_DIR;
- lost_vectors.jsonl (title,artist,source_url,image_url,embedding): precomputed
  clip-ViT-B-32 vectors, loaded as is; image_url stays a remote URL, nothing is downloaded.

The table is synced to these files: new rows are added, rows whose title,
artist or image changed are updated, rows missing from the files are deleted.
The backend runs this on every start; running it again changes nothing.

Usage: python -m scripts.index_lost [--reset]
"""

import argparse
import csv
import json
import logging
import shutil
from dataclasses import dataclass

from sqlalchemy import delete, select

from app.config import settings
from app.db import SessionLocal, init_db
from app.models import EMBEDDING_DIM, LostArtwork
from app.services import embeddings

log = logging.getLogger("rodowod.index_lost")

# Above this two images show one painting (e.g. the CSV and the JSONL list the same work).
SAME_WORK_SIMILARITY = 0.95


@dataclass
class Wanted:
    title: str
    artist: str
    source_url: str
    image_url: str
    embedding: list[float] | None = None  # None: compute from csv_image
    csv_image: str | None = None


@dataclass
class SyncResult:
    added: int = 0
    updated: int = 0
    deleted: int = 0
    skipped: int = 0


def wanted_rows() -> list[Wanted]:
    lost_dir = settings.data_dir / "lost"
    rows: dict[str, Wanted] = {}
    csv_path = lost_dir / "lost.csv"
    if csv_path.exists():
        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                rows.setdefault(row["source_url"], Wanted(
                    title=row["title"], artist=row.get("artist") or "", source_url=row["source_url"],
                    image_url=f"/media/lost_{row['image_file']}", csv_image=row["image_file"],
                ))
    vectors = lost_dir / "lost_vectors.jsonl"
    if vectors.exists():
        with open(vectors, encoding="utf-8") as f:
            for line in f:
                row = json.loads(line)
                if len(row["embedding"]) != EMBEDDING_DIM:
                    log.warning("%r has a %d-d vector, row skipped", row["title"], len(row["embedding"]))
                    continue
                rows.setdefault(row["source_url"], Wanted(
                    title=row["title"], artist=row.get("artist") or "", source_url=row["source_url"],
                    image_url=row["image_url"], embedding=row["embedding"],
                ))
    return list(rows.values())


def _embedding(w: Wanted) -> list[float] | None:
    if w.embedding is not None:
        return w.embedding
    src = settings.data_dir / "lost" / "images" / w.csv_image
    if not src.exists():
        log.warning("missing image %s, row skipped", src)
        return None
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, settings.media_dir / f"lost_{w.csv_image}")
    return embeddings.embed_image(src)


def sync(reset: bool = False) -> SyncResult:
    init_db()
    result = SyncResult()
    wanted = wanted_rows()
    with SessionLocal() as db:
        if reset:
            db.execute(delete(LostArtwork))
            db.flush()
        current = {row.source_url: row for row in db.scalars(select(LostArtwork))}

        keep = {w.source_url for w in wanted}
        for url, row in current.items():
            if url not in keep:
                db.delete(row)
                result.deleted += 1
        db.flush()

        for w in wanted:
            row = current.get(w.source_url)
            if row is not None and (row.title, row.artist, row.image_url) == (w.title, w.artist, w.image_url):
                continue
            vector = _embedding(w)
            if vector is None:
                result.skipped += 1
                continue
            if row is not None:
                row.title, row.artist, row.image_url, row.embedding = w.title, w.artist, w.image_url, vector
                result.updated += 1
                continue
            db.flush()
            distance = LostArtwork.embedding.cosine_distance(vector)
            closest = db.execute(select(LostArtwork.title, distance).order_by(distance).limit(1)).first()
            if closest is not None and 1 - closest[1] >= SAME_WORK_SIMILARITY:
                log.info("%r is already indexed as %r, row skipped", w.title, closest[0])
                result.skipped += 1
                continue
            db.add(LostArtwork(title=w.title, artist=w.artist, source_url=w.source_url,
                               image_url=w.image_url, embedding=vector))
            result.added += 1
        db.commit()
    return result


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="clear lost_artworks first")
    args = parser.parse_args()
    r = sync(reset=args.reset)
    print(f"done: {r.added} added, {r.updated} updated, {r.deleted} deleted, {r.skipped} skipped")


if __name__ == "__main__":
    main()
