# Backend notes: pitfalls in the spec and how they are handled

Everything below is backend behaviour that the spec either leaves open or would
get wrong if implemented literally. Two contract changes: a new error code for
duplicate registrations (section 13), and accounts with login and password in
place of the `X-User-Id` header (section 15).

## 1. Passport hashes and time zones

**Problem.** `event_payload` formats `created_at` with `strftime("...Z")`. Postgres
returns `timestamptz` in the session time zone, so on a server or connection
that is not UTC the formatted string differs from the one hashed at insert
time, and every chain shows `chainValid: false`.

**Fix.**
- `app/timeutil.py:iso_utc` converts to UTC before formatting; the hash payload
  and all API responses use it.
- `app/db.py` pins every connection to UTC (`-c timezone=UTC`) as a second guard.
- `created_at` is `timestamptz` and is created with microseconds stripped.

## 2. Time format in responses

**Problem.** Pydantic serializes `datetime` as `2026-10-10T14:32:00.123456+00:00`;
the contract wants `2026-10-10T14:32:00Z`.

**Fix.** `UtcDateTime` in `app/schemas.py` is a `datetime` with a serializer
that calls `iso_utc`. Every time field in the DTOs uses it, including WebSocket
messages.

## 3. Auction end races

**Problem.** The background loop runs once per second, so `status` can still be
`live` for up to a second after `ends_at`. A bid in that window would be
accepted after the auction is over, or right after the owner already changed.

**Fix.** (`app/services/auction_engine.py`)
- `place_bid` locks the auction row (`SELECT ... FOR UPDATE`) and checks the
  clock (`starts_at <= now < ends_at`), not only `status`.
- Finishing an auction locks the same row and re-checks `ends_at` under the
  lock, so a last-second bid that extended `ends_at` (anti-sniping) keeps the
  auction open. Ownership change, the `ownership_change` event and the status
  update commit in one transaction.
- `ended` and `bid` are broadcast only after commit.

## 4. One unfinished auction per artwork

**Problem.** Two concurrent `POST /auctions` for the same artwork could both pass
the `AUCTION_EXISTS` check.

**Fix.** The artwork row is locked while checking, and a partial unique index
(`artwork_id WHERE status <> 'ended'`) backs it in the database; a violation is
reported as `AUCTION_EXISTS`.

## 5. Concurrent passport appends

**Problem.** Two events appended at the same time read the same last `seq` and
collide on `(artwork_id, seq)`.

**Fix.** `append_event` locks the artwork row before reading the last event.

## 6. Single process

**Problem.** `ws_hub` subscribers and the auction loop live in process memory.
With several uvicorn workers, bids made on one worker never reach sockets on
another, and each worker runs its own auction loop.

**Fix.** The Dockerfile runs uvicorn with `--workers 1`. Do not raise it.

## 7. Auctions start immediately

`CreateAuctionRequest` has no `startsAt`, so a new auction is created as `live`
with `startsAt = now` and `endsAt = now + durationMinutes`. `scheduled` only
appears in seeded or future data; the loop moves it to `live` when due.

## 8. WebSocket details

- **Close code 4404.** Closing a WebSocket before `accept()` becomes an HTTP 403
  and the client never sees the code. The server accepts first, then closes
  with 4404 when the auction does not exist.
- **Snapshot ordering.** The socket is subscribed before the snapshot is read,
  and a per-socket lock is held while the snapshot is sent, so no `bid` arrives
  before the `snapshot` and no bid is lost between them. A bid committed just
  before the snapshot read may arrive once more as a `bid` message after the
  snapshot: **frontend, dedupe `bids` by `id`**.
- After `ended` the socket stays open; a reconnect gets a `snapshot` with
  `status: "ended"` and the winner in `leader`.

## 9. Uploads

- The format is detected from the file bytes (Pillow), not from the
  client's `Content-Type`; anything except JPEG, PNG and WebP is
  `UNSUPPORTED_FILE`.
- Phone photos store rotation in EXIF. The upload is rotated upright
  (`exif_transpose`), resized to at most 1600 px and saved as JPEG, so the
  image shown and the CLIP embedding match what the user sees. Without this a
  sideways photo of a lost painting can miss the match.
- Size is checked while reading; over 10 MB is `FILE_TOO_LARGE`.

## 10. Seed and the lost dataset

- `seed.py --reset` drops only the app tables (users, sessions, artworks,
  passports, auctions). `lost_artworks` is kept, since rebuilding it with
  `index_lost.py` takes minutes. Everyone is logged out after a reset.
- Seeded artworks go through the real loss check, so run `index_lost.py` first.
- `index_lost.py` skips rows whose `source_url` is already indexed, so it can
  be re-run after adding rows to `lost.csv`.
- Seed titles come from the design concepts (`ARTWORKS` in `scripts/seed.py`).
  Missing images in `data/demo/` are replaced with a plain placeholder and a
  warning.

## 11. CLIP in Docker

- torch is installed from the CPU wheel index; the default wheel pulls CUDA.
- Model weights go to the `hfcache` volume and are downloaded once, on the
  first start.
- The image uses Python 3.12 for wheel availability.

## 12. AI description

`/api/ai/describe` calls Azure OpenAI (v1 endpoint, `POST {LLM_BASE_URL}/chat/completions`
with the image as a data URL). `LLM_MODEL` is the deployment name. Without
`LLM_API_KEY`, or on any provider error, it answers `502 AI_UNAVAILABLE`, and the
frontend leaves the form empty for manual input. The prompt, timeout and
response schema are in `app/services/ai_describe.py`.

## 13. Duplicate registrations (new error code)

**Problem.** The spec only compares a new artwork with the war-loss database,
so the same painting could be registered twice, also by different owners.

**Fix.** `POST /api/artworks` compares the photo's CLIP vector with every
registered artwork and refuses a near-identical one:

| HTTP | code | When |
| --- | --- | --- |
| 409 | ARTWORK\_DUPLICATE | the photo matches an already registered artwork |

- The threshold is `DUPLICATE_MATCH_THRESHOLD` (default `0.92`) and needs the
  same calibration as the loss threshold: photos of the same work vs.
  different works.
- Held artworks are not counted as registered, so the red-screen demo works
  for the same lost painting more than once.
- Registrations are serialized with a transaction-level advisory lock, so two
  simultaneous uploads of the same picture cannot both pass the check.
- `types.ts` needs no change (`ApiError.detail.code` is a string); the error
  table in the spec gets the new row, and the frontend should show `message`.

## 14. Azure Database for PostgreSQL Flexible Server

The code runs on Azure PostgreSQL unchanged; only connection settings differ.

**Connection.** Set these instead of `DATABASE_URL` (values from the server's
Overview and Connect pages in the Azure portal):

| Variable | Example |
| --- | --- |
| `DB_HOST` | `rodowod-db.postgres.database.azure.com` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `rodowod` |
| `DB_USER` | `rodowodadmin` (plain name, no `@server` suffix on Flexible Server) |
| `DB_PASSWORD` | any characters; it is escaped for the URL |
| `DB_SSLMODE` | `require` (default); Azure refuses connections without TLS |
| `DB_SSLROOTCERT` | optional, path to the CA bundle when using `verify-full` |

When `DB_HOST` is set it wins over `DATABASE_URL`, also inside docker compose,
so the local `db` container can stay as it is.

**One-time server setup in the portal:**
1. *Server parameters* → `azure.extensions` → add `VECTOR` and save. Without it
   `CREATE EXTENSION vector` at startup fails with "extension is not allow-listed".
2. *Databases* → create `rodowod` (the server only has `postgres` by default).
3. *Networking* → add a firewall rule for the machine or service running the
   backend (and for your own IP to run the seed).
4. Use port 5432, not the built-in PgBouncer on 6432: the backend sets the
   session time zone through a startup option, which PgBouncer rejects.

**Then**, with the variables exported or in `.env`:

```bash
docker compose up -d --build backend
docker compose exec backend python -m scripts.index_lost
docker compose exec backend python -m scripts.seed --reset
```

Tables are created on startup by the admin user. Connections are recycled
every 30 minutes, since Azure drops long-idle ones.

## 15. Accounts and sessions (MVP)

**Change.** The spec identified the user by an `X-User-Id` header that anyone
could set. It is replaced by login and password accounts; there is no e-mail
and no password reset.

- `POST /api/auth/register {username, password}` → `201 {token, user}`.
  Login: 3–32 characters, `a-z 0-9 . _ -`, stored lowercase. Password: 6–128
  characters. Errors: `400 INVALID_USERNAME`, `400 WEAK_PASSWORD`,
  `409 USERNAME_TAKEN`.
- `POST /api/auth/login` → `200 {token, user}` or `401 INVALID_CREDENTIALS`.
- `GET /api/auth/me` → `UserDto`; `POST /api/auth/logout` → `204`.
- Protected endpoints read `Authorization: Bearer <token>` and answer
  `401 NO_USER` without a valid token. Reading stays public.
- Passwords: `hashlib.scrypt` (N=2^14, r=8, p=1, 16-byte salt), compared with
  `hmac.compare_digest`. Tokens: 32 random bytes; only their SHA-256 is stored
  in `auth_tokens`, so a database leak does not expose live sessions. Tokens do
  not expire; logout deletes the row.
- Migration: `init_db` adds `users.username` and `users.password_hash` with
  `ADD COLUMN IF NOT EXISTS`, so an existing database keeps its data. Old users
  have no password until `seed --reset` recreates them.
- Seed accounts: `anna` (owner of the catalog), `piotr`, `ewa`; password
  `demo1234`.
