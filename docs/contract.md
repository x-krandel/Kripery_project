# Контракт API

Полное ТЗ с контрактом лежит в документе команды «Rodowód: ТЗ бэкенда и фронтенда».

В коде контракт живёт в двух файлах, которые обязаны совпадать поле в поле:

- `frontend/src/api/types.ts`: TypeScript-типы (camelCase)
- `backend/app/schemas.py`: Pydantic-модели (snake_case в Python, camelCase в JSON через `CamelModel`)

Правило: контракт меняется только PR, который правит оба файла сразу.

## Авторизация (изменение относительно ТЗ)

Заголовок `X-User-Id` больше не работает. Вместо него аккаунты с логином и паролем:

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/api/auth/register` | `{username, password}` | `201 {token, user: UserDto}` |
| POST | `/api/auth/login` | `{username, password}` | `200 {token, user: UserDto}` |
| GET | `/api/auth/me` | – | `200 UserDto` |
| POST | `/api/auth/logout` | – | `204` |

Защищённые запросы (создать работу, добавить запись в паспорт, создать аукцион, ставка) шлют `Authorization: Bearer <token>`. Без токена или с неверным: `401 NO_USER`. Чтение (каталог, паспорта, аукционы, WebSocket) открыто всем.

Новые коды ошибок: `INVALID_USERNAME` (400), `WEAK_PASSWORD` (400), `USERNAME_TAKEN` (409), `INVALID_CREDENTIALS` (401). Детали: [backend-notes.md, раздел 15](backend-notes.md).

## Дубликаты

`POST /api/artworks` отвечает `409 ARTWORK_DUPLICATE`, если фото почти совпадает с уже зарегистрированной работой. Совпадение с базой потерь важнее: такая работа получает `held` и красный экран, а не 409. Детали: [backend-notes.md, раздел 13](backend-notes.md).

Сверка после фриза:

```bash
cd frontend
npx openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.d.ts
```

## Access rules

- Login required (`Authorization: Bearer <token>`, otherwise `401 NO_USER`): `POST /api/uploads`, `POST /api/ai/describe`, `POST /api/artworks`, `POST /api/artworks/{id}/events`, `POST /api/auctions`, `POST /api/auctions/{id}/bids`, `GET /api/auth/me`, `POST /api/auth/logout`.
- Held artworks (a possible war-loss match, `status: "held"`) are visible to their owner only. For anyone else, including anonymous visitors:
  - `GET /api/artworks/{id}`, `GET /api/artworks/{id}/passport` and `POST /api/artworks/{id}/events` answer `404 NOT_FOUND`;
  - `GET /api/artworks?ownerId=X` returns only published works unless X is the logged-in user;
  - `GET /api/artworks` without `ownerId` returns published works only, for everyone.
- Public reads accept the token but do not require it; a missing or stale token is treated as anonymous, never as `401`.

## Additions (2026-10-11)

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/api/stats` | – | `200 StatsDto`: published works, passport entries, private collections, offer volume (PLN), indexed war losses |
| GET | `/api/artworks/{id}/similar?limit=4` | – | `200 SimilarArtworkDto[]`: nearest published works by CLIP image vector, `similarity` 0..1 |
| GET | `/api/posts?authorId=&artworkId=` | – | `200 PostDto[]`, newest first; posts about held works only for their author |
| POST | `/api/posts/offline-auction` | `{artworkId, startsAt, place, minPrice, body}` | `201 PostDto`: invitation to an in-person auction, owner only |
| DELETE | `/api/posts/{id}` | – | `204`, author only |

`ArtworkSummaryDto.lastPrice`: price of the latest auction (current offer, or the final price once it ended), `null` if the work was never auctioned. New error codes: `INVALID_DATE` (400, offline auction in the past), `NOT_AUTHOR` (403, deleting someone else's post).
