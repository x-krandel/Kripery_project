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
from app.services.auth import hash_password
from app.services.hashing import append_event
from app.timeutil import utcnow

# (id, name, role, login). All demo accounts share DEMO_PASSWORD; it is shown on the login page.
USERS = [(1, "Anna", "collector", "anna"), (2, "Piotr", "buyer", "piotr"), (3, "Ewa", "buyer", "ewa")]
DEMO_PASSWORD = "demo1234"

# Same catalog as the approved design concepts (and frontend/src/api/mocks.ts).
# image = file in data/demo/ (placeholders until real public-domain works are added).
# Optional "history": (type, occurred_on, title, description) instead of the generic HISTORY.
ARTWORKS = [
    dict(image="01.jpg", owner=1, title="Portret damy w czerni", artist="Szkoła polska", dating="ok. 1895",
         technique="olej na płótnie", category="painting", dimensions="64 × 48 cm",
         story="Obraz wisiał w salonie mojej prababci w Krakowie. Po wojnie przyjechał z rodziną do Wrocławia, "
               "owinięty w koc, razem z albumem zdjęć.",
         history=[
             ("creation", "1895", "Obraz powstaje w Krakowie",
              "Sygnatura i data na odwrocie płótna. Zdjęcie odwrocia w załączniku."),
             ("exhibition", "1912", "Wystawa salonowa w Krakowie",
              "Wzmianka w katalogu wystawy. Skan strony katalogu w załączniku."),
             ("ownership_change", "1968", "Zakup do kolekcji rodzinnej",
              "Odręczny rachunek sprzedaży. Obraz trafia do rodziny obecnej właścicielki."),
             ("conservation", "2019", "Oczyszczenie werniksu i dublowanie płótna",
              "Protokół konserwatorski (PDF) z opisem zakresu prac."),
         ]),
    dict(image="02.jpg", owner=1, title="Widok na Odrę", artist="Szkoła wrocławska", dating="ok. 1910",
         technique="olej na desce", category="painting", dimensions="38 × 52 cm",
         story="Kupiony na pchlim targu przy Hali Targowej w latach 90."),
    dict(image="03.jpg", owner=1, title="Pejzaż jesienny", artist="Szkoła polska", dating="ok. 1880",
         technique="olej na płótnie", category="painting", dimensions="72 × 90 cm",
         story="Pamiątka rodzinna, przez lata wisiała w dworku pod Kaliszem."),
    dict(image="04.jpg", owner=1, title="Martwa natura z dzbanem", artist="Malarz nieznany", dating="XIX w.",
         technique="olej na płótnie", category="painting", dimensions="46 × 38 cm",
         story="Obraz z kolekcji dziadka, sygnatura nieczytelna."),
    dict(image="05.jpg", owner=1, title="Kamienice przy rynku", artist="Szkoła polska", dating="ok. 1925",
         technique="gwasz na papierze", category="works_on_paper", dimensions="30 × 42 cm",
         story="Gwasz kupiony w antykwariacie w Krakowie w 2004 roku."),
    dict(image="06.jpg", owner=1, title="Studium głowy kobiety", artist="Krąg akademicki", dating="ok. 1900",
         technique="węgiel na papierze", category="works_on_paper", dimensions="48 × 36 cm",
         story="Rysunek z teki studenckiej, przechowywany w passe-partout."),
    dict(image="07.jpg", owner=2, title="Owoce na cynowym talerzu", artist="Malarz nieznany", dating="ok. 1870",
         technique="olej na płótnie", category="painting", dimensions="40 × 50 cm",
         story="Obraz odziedziczony po ciotce z Lwowa."),
    dict(image="08.jpg", owner=3, title="Łąka przed burzą", artist="Szkoła polska", dating="ok. 1905",
         technique="olej na tekturze", category="painting", dimensions="33 × 41 cm",
         story="Mały format, malowany prawdopodobnie w plenerze."),
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


def seed() -> int:
    now = utcnow()
    auctions_created = 0
    with SessionLocal() as db:
        for uid, name, role, username in USERS:
            db.add(User(id=uid, name=name, role=role, username=username, password_hash=hash_password(DEMO_PASSWORD)))
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
            history = spec.get("history") or [
                (type_, spec["dating"] if type_ == "creation" else "", title, description)
                for type_, title, description in HISTORY[: 1 + i % len(HISTORY)]
            ]
            for type_, occurred, title, description in history:
                append_event(db, artwork.id, type_, occurred, title, description)
            append_event(
                db, artwork.id, "registration", now.date().isoformat(), loss_check.REGISTRATION_TITLE,
                loss_check.registration_description(check.result),
            )
            artworks.append(artwork)

        for idx, start, step, minutes, bids in AUCTIONS:
            if artworks[idx].status == "held":
                # The API refuses this (ARTWORK_HELD); the seed bypasses the API, so check here.
                print(f"warning: '{artworks[idx].title}' is held by the loss check, no auction created")
                continue
            starts = now - timedelta(minutes=10)
            auctions_created += 1
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
    return auctions_created


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop app tables before seeding")
    args = parser.parse_args()
    if args.reset:
        reset()
    init_db()
    n = seed()
    print(f"seeded: {len(USERS)} users, {len(ARTWORKS)} artworks, {n} auctions")


if __name__ == "__main__":
    main()
