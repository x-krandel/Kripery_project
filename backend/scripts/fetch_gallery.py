"""Downloads a demo gallery of famous public-domain paintings into data/gallery/.

Run it once on a computer with normal internet access (not inside the backend container):

    python3 backend/scripts/fetch_gallery.py            # about 40 works
    python3 backend/scripts/fetch_gallery.py --limit 20

Only the Python standard library is needed. Metadata comes from Wikidata, images (800 px wide)
from Wikimedia Commons. Only works whose author died in 1955 or earlier are taken, so they are in
the public domain in Poland and the EU. The result is data/gallery/gallery.csv plus
data/gallery/images/<Q-id>.jpg; commit both, and the backend adds them with
`python -m scripts.seed_gallery` (AUTO_SEED=true does that on startup).
"""

import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "gallery"
SPARQL = "https://query.wikidata.org/sparql"
UA = "RodowodHackathonDemo/1.0 (BEST Hacks 2026 student project; https://github.com/x-krandel/Kripery_project)"

# {where} narrows the paintings; labels in Polish, then English.
QUERY = """
SELECT ?item ?title ?artist ?date ?image ?collection ?sitelinks WHERE {
  { SELECT ?item (SAMPLE(?img) AS ?image) (SAMPLE(?creator) AS ?cr) (MIN(?inception) AS ?date)
           (SAMPLE(?coll) AS ?cl) (MAX(?links) AS ?sitelinks) WHERE {
      ?item wdt:P31 wd:Q3305213; wdt:P18 ?img; wdt:P170 ?creator; wikibase:sitelinks ?links.
      ?creator wdt:P570 ?death. FILTER(YEAR(?death) <= 1955)
      OPTIONAL { ?item wdt:P571 ?inception }
      OPTIONAL { ?item wdt:P195 ?coll }
      {where}
    } GROUP BY ?item ORDER BY DESC(?sitelinks) LIMIT {limit} }
  # Labels only for the selected rows: Polish first, then English.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en".
    ?item rdfs:label ?title. ?cr rdfs:label ?artist. ?cl rdfs:label ?collection. }
}
"""
SETS = [
    # Works in Polish museums (National Museums in Warsaw, Kraków, Poznań, Wrocław, ...).
    ("polish museums", "?item wdt:P195 ?pl. ?pl wdt:P17 wd:Q36."),
    # The world's best-known paintings, by number of Wikipedia articles about them.
    ("world classics", "FILTER(?links > 40)"),
]


def sparql(query: str) -> list[dict]:
    url = SPARQL + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.load(resp)
    return [{k: v["value"] for k, v in row.items()} for row in data["results"]["bindings"]]


def to_row(b: dict) -> dict | None:
    qid = b["item"].rsplit("/", 1)[-1]
    title, artist = b.get("title", ""), b.get("artist", "")
    if not title or title == qid or not artist or artist.startswith("Q"):
        return None  # no Polish or English label
    date = b.get("date", "")
    dating = date[:4].lstrip("+") if date[:1] in "+0123456789" else ""
    return {
        "qid": qid, "title": title, "artist": artist, "dating": dating,
        "collection": b.get("collection", ""), "image_file": f"{qid}.jpg",
        "image_url": b["image"].replace("http://", "https://", 1) + "?width=800",
        "source_url": f"https://www.wikidata.org/wiki/{qid}",
    }


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=40, help="total number of works (split between the two sets)")
    args = parser.parse_args()
    per_set = max(1, args.limit // len(SETS))

    rows: dict[str, dict] = {}
    for name, where in SETS:
        try:
            found = sparql(QUERY.replace("{where}", where).replace("{limit}", str(per_set * 2)))
        except Exception as e:  # noqa: BLE001 - report and keep the other set
            print(f"{name}: query failed ({e})", file=sys.stderr)
            continue
        added = 0
        for b in found:
            row = to_row(b)
            if row and row["qid"] not in rows and added < per_set:
                rows[row["qid"]] = row
                added += 1
        print(f"{name}: {added} works")

    (OUT / "images").mkdir(parents=True, exist_ok=True)
    kept = []
    for row in rows.values():
        dest = OUT / "images" / row["image_file"]
        try:
            if not dest.exists():
                download(row["image_url"], dest)
                time.sleep(0.4)  # be gentle with Wikimedia
            kept.append(row)
            print(f"  ok  {row['title']} ({row['artist']})")
        except Exception as e:  # noqa: BLE001
            print(f"  --  {row['title']}: {e}", file=sys.stderr)

    fields = ["title", "artist", "dating", "collection", "image_file", "source_url"]
    with open(OUT / "gallery.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(kept)
    print(f"\n{len(kept)} works in {OUT / 'gallery.csv'}. Commit data/gallery/ and deploy.")


if __name__ == "__main__":
    main()
