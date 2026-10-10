# Контракт API

Полное ТЗ с контрактом лежит в документе команды «Rodowód — ТЗ бэкенда и фронтенда».

В коде контракт живёт в двух файлах, которые обязаны совпадать поле в поле:

- `frontend/src/api/types.ts` — TypeScript-типы (camelCase)
- `backend/app/schemas.py` — Pydantic-модели (snake_case в Python, camelCase в JSON через `CamelModel`)

Правило: контракт меняется только PR, который правит оба файла сразу.

## Авторизация (изменение относительно ТЗ)

Заголовок `X-User-Id` больше не работает. Вместо него аккаунты с логином и паролем:

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/api/auth/register` | `{username, password}` | `201 {token, user: UserDto}` |
| POST | `/api/auth/login` | `{username, password}` | `200 {token, user: UserDto}` |
| GET | `/api/auth/me` | — | `200 UserDto` |
| POST | `/api/auth/logout` | — | `204` |

Защищённые запросы (создать работу, добавить запись в паспорт, создать аукцион, ставка) шлют `Authorization: Bearer <token>`. Без токена или с неверным: `401 NO_USER`. Чтение (каталог, паспорта, аукционы, WebSocket) открыто всем.

Новые коды ошибок: `INVALID_USERNAME` (400), `WEAK_PASSWORD` (400), `USERNAME_TAKEN` (409), `INVALID_CREDENTIALS` (401). Детали: [backend-notes.md, раздел 15](backend-notes.md).

Сверка после фриза:

```bash
cd frontend
npx openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.d.ts
```
