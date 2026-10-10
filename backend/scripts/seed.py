"""Demo data: 3 users, 8 artworks with passport history, 3 live auctions.

Usage: python -m scripts.seed --reset
Run scripts.index_lost first so the seeded works get a real loss check.
"""

import argparse
import shutil
from datetime import timedelta

from PIL import Image
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal, engine, init_db
from app.models import Artwork, Auction, Base, Bid, LostArtwork, User
from app.services import embeddings, loss_check
from app.services.hashing import append_event
from app.timeutil import utcnow

USERS = [(1, "Anna", "collector"), (2, "Piotr", "buyer"), (3, "Ewa", "buyer")]

# Titles must match the catalog on the approved design concepts; replace the
# placeholders below once they are copied from there. image = file in data/demo/.
ARTWORKS = [
    dict(image="01.jpg", owner=1, title="Pejzaż z Tatr", artist="Szkoła polska", dating="ok. 1895",
         technique="olej na płótnie", category="painting", dimensions="64 × 48 cm",
         story="Obraz przez trzy pokolenia wisiał w domu rodzinnym pod Krakowem."),
    dict(image="02.jpg", owner=1, title="Portret kobiety w czepku", artist="Autor nieznany", dating="ok. 1860",
         technique="olej na desce", category="painting", dimensions="42 × 34 cm",
         story="Zakupiony na aukcji w Warszawie w 1978 roku."),
    dict(image="03.jpg", owner=1, title="Martwa natura z dzbanem", artist="Szkoła polska", dating="1912",
         technique="olej na tekturze", category="painting", dimensions="50 × 40 cm",
         story="Sygnowany monogramem w lewym dolnym rogu."),
    dict(image="04.jpg", owner=1, title="Ulica w Kazimierzu", artist="Szkoła polska", dating="ok. 1930",
         technique="akwarela na papierze", category="works_on_paper", dimensions="30 × 22 cm",
         story="Pamiątka z pleneru malarskiego nad Wisłą."),
    dict(image="05.jpg", owner=1, title="Studium konia", artist="Autor nieznany", dating="XIX w.",
         technique="ołówek na papierze", category="works_on_paper", dimensions="24 × 18 cm",
         story="Rysunek odnaleziony w tece po dziadku."),
    dict(image="06.jpg", owner=1, title="Głowa chłopca", artist="Szkoła polska", dating="ok. 1925",
         technique="brąz patynowany", category="sculpture", dimensions="wys. 28 cm",
         story="Odlew z pracowni warszawskiej."),
    dict(image="07.jpg", owner=2, title="Zachód słońca nad Wisłą", artist="Szkoła polska", dating="1948",
         technique="olej na płótnie", category="painting", dimensions="70 × 50 cm",
         story="Kupiony od rodziny artysty."),
    dict(image="08.jpg", owner=3, title="Kompozycja abstrakcyjna", artist="Autor nieznany", dating="1967",
         technique="gwasz na papierze", category="works_on_paper", dimensions="35 × 25 cm",
         story="Praca z okresu studiów na ASP."),
]

HISTORY = [
    ("creation", "Utworzenie", "Powstanie dzieła."),
    ("exhibition", "Wystawa", "Wystawa zbiorowa w Towarzystwie Zachęty Sztuk Pięknych."),
    ("conservation", "Konserwacja", "Oczyszczenie i zabezpieczenie warstwy malarskiej."),
    ("ownership_change", "Zmiana właściciela", "Przekazanie w spadku."),
]

# (artwork index, start price, min step, minutes until end, bids as (user id, amount))
AUCTIONS = [
    (0, 12000, 500, 5, [(2, 12000), (3, 12500), (2, 13500)]),
    (1, 8000, 200, 30, [(3, 8000)]),
    (2, 4500, 100, 120, []),
]

APP_TABLES = [t for t in Base.metadata.sorted_tables if t.name != LostArtwork.__tablename__]


def reset() -> None:
    # lost_artworks is kept: it is filled by index_lost.py and costs minutes to rebuild.
    Base.metadata.drop_all(engine, tables=APP_TABLES)


def media_copy(name: str) -> str:
    src = settings.data_dir / "demo" / name
    dst = settings.media_dir / f"demo_{name}"
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    if src.exists():
        shutil.copyfile(src, dst)
    else:
        print(f"warning: {src} is missing, using a placeholder image")
        Image.new("RGB", (800, 600), (230, 222, 211)).save(dst, "JPEG")
    return dst.name


def seed() -> None:
    now = utcnow()
    with SessionLocal() as db:
        for uid, name, role in USERS:
            db.add(User(id=uid, name=name, role=role))
        db.flush()

        artworks: list[Artwork] = []
        for i, spec in enumerate(ARTWORKS):
            file_name = media_copy(spec["image"])
            vec = embeddings.embed_image(settings.media_dir / file_name)
            check = loss_check.check(db, vec)
            artwork = Artwork(
                owner_id=spec["owner"], title=spec["title"], artist=spec["artist"], dating=spec["dating"],
                technique=spec["technique"], category=spec["category"], dimensions=spec["dimensions"],
                story=spec["story"], image_url=f"/media/{file_name}",
                status="held" if check.result == "match" else "published", embedding=vec,
                loss_result=check.result, loss_top_similarity=check.top_similarity,
                loss_checked_at=check.checked_at, loss_matches=check.matches, created_at=now,
            )
            db.add(artwork)
            db.flush()
            # 1 to 4 historical events, then registration: 2 to 5 in total.
            for type_, title, description in HISTORY[: 1 + i % len(HISTORY)]:
                occurred = spec["dating"] if type_ == "creation" else ""
                append_event(db, artwork.id, type_, occurred, title, description)
            append_event(
                db, artwork.id, "registration", now.date().isoformat(), "Dodano do Rodowodu",
                "Automatyczne porównanie z bazą strat wojennych MKiDN: "
                + ("możliwe dopasowanie, publikacja wstrzymana" if check.result == "match" else "brak dopasowań"),
            )
            artworks.append(artwork)

        for idx, start, step, minutes, bids in AUCTIONS:
            starts = now - timedelta(minutes=10)
            auction = Auction(
                artwork_id=artworks[idx].id, status="live", start_price=start, min_step=step,
                current_price=start, bid_count=0, starts_at=starts,
                ends_at=now + timedelta(minutes=minutes), created_at=starts,
            )
            db.add(auction)
            db.flush()
            for n, (user_id, amount) in enumerate(bids):
                db.add(Bid(auction_id=auction.id, user_id=user_id, amount=amount,
                           created_at=starts + timedelta(minutes=n + 1)))
                auction.current_price = amount
                auction.leader_id = user_id
                auction.bid_count += 1
        db.commit()

        # Explicit ids above do not advance the sequence.
        db.execute(text("SELECT setval('users_id_seq', (SELECT max(id) FROM users))"))
        db.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop app tables before seeding")
    args = parser.parse_args()
    if args.reset:
        reset()
    init_db()
    seed()
    print("seeded: 3 users, 8 artworks, 3 auctions")


if __name__ == "__main__":
    main()
