# Public-domain gallery

Famous paintings for the demo catalog and for "Podobne dzieła" (similar works by CLIP vector).

1. On a computer with normal internet access, from the repository root:
   ```bash
   python3 backend/scripts/fetch_gallery.py        # about 40 works; --limit 20 for fewer
   ```
   It writes `gallery.csv` and `images/<Q-id>.jpg` here. Metadata comes from Wikidata, images (800 px) from Wikimedia Commons. Only works whose author died in 1955 or earlier are taken, so they are in the public domain in Poland and the EU.
2. Commit `data/gallery/` and deploy. With `AUTO_SEED=true` the backend adds the new works on startup; locally run `docker compose exec backend python -m scripts.seed_gallery`.

The works belong to the "Galeria klasyków" account, which has no password. Adding is idempotent: rows already in the database (same title and author) are skipped, nothing is deleted.
