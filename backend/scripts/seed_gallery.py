"""Adds the public-domain demo gallery (data/gallery/gallery.csv) without touching other data.

Usage: python -m scripts.seed_gallery
Works go to the "Galeria klasyków" account (no password, nobody can log in as it). Rows already
in the database (same title and author) are skipped, so it can run again after new rows are added
to the CSV. The CSV and images come from scripts/fetch_gallery.py.
"""

import csv
import shutil

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal, init_db
from app.models import Artwork, User
from app.services import embeddings, loss_check
from app.services.hashing import append_event
from app.timeutil import utcnow

GALLERY_USERNAME = "galeria"
GALLERY_NAME = "Galeria klasyków"


def gallery_user(db) -> User:
    user = db.scalar(select(User).where(User.username == GALLERY_USERNAME))
    if user is None:
        user = User(name=GALLERY_NAME, role="collector", username=GALLERY_USERNAME, password_hash=None)
        db.add(user)
        db.flush()
    return user


def seed_gallery() -> int:
    """Returns the number of works added."""
    gallery = settings.data_dir / "gallery"
    csv_path = gallery / "gallery.csv"
    if not csv_path.exists():
        return 0
    init_db()
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    added = 0
    now = utcnow()
    with SessionLocal() as db, open(csv_path, newline="", encoding="utf-8") as f:
        owner = gallery_user(db)
        known = {(t, a) for t, a in db.execute(select(Artwork.title, Artwork.artist).where(Artwork.owner_id == owner.id))}
        for row in csv.DictReader(f):
            title, artist = row["title"].strip(), row["artist"].strip()
            src = gallery / "images" / row["image_file"]
            if (title, artist) in known or not src.exists():
                continue
            file_name = f"gallery_{row['image_file']}"
            shutil.copyfile(src, settings.media_dir / file_name)
            vec = embeddings.embed_image(settings.media_dir / file_name)
            check = loss_check.check(db, vec)
            collection = row.get("collection", "").strip()
            artwork = Artwork(
                owner_id=owner.id, title=title, artist=artist, dating=row.get("dating", "").strip(),
                technique="", category="painting", dimensions="",
                story=(f"W zbiorach: {collection}. " if collection else "")
                + "Dzieło w domenie publicznej, zdjęcie z Wikimedia Commons. Opis: "
                + row.get("source_url", "").strip(),
                image_url=f"/media/{file_name}", status="held" if check.result == "match" else "published",
                embedding=vec, loss_result=check.result, loss_top_similarity=check.top_similarity,
                loss_checked_at=check.checked_at, loss_matches=check.matches, created_at=now,
            )
            db.add(artwork)
            db.flush()
            if artwork.dating:
                append_event(db, artwork.id, "creation", artwork.dating, "Powstanie dzieła", f"{artist}, {artwork.dating}.")
            append_event(db, artwork.id, "registration", now.date().isoformat(), loss_check.REGISTRATION_TITLE,
                         loss_check.registration_description(check.result))
            known.add((title, artist))
            added += 1
        db.commit()
    return added


def main() -> None:
    print(f"gallery: {seed_gallery()} works added")


if __name__ == "__main__":
    main()
