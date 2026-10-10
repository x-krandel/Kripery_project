# Контракт API

Полное ТЗ с контрактом лежит в документе команды «Rodowód — ТЗ бэкенда и фронтенда».

В коде контракт живёт в двух файлах, которые обязаны совпадать поле в поле:

- `frontend/src/api/types.ts` — TypeScript-типы (camelCase)
- `backend/app/schemas.py` — Pydantic-модели (snake_case в Python, camelCase в JSON через `CamelModel`)

Правило: контракт меняется только PR, который правит оба файла сразу.

Сверка после фриза:

```bash
cd frontend
npx openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.d.ts
```
