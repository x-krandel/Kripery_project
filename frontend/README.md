# Rodowód: frontend

Vite + React 19 + TypeScript + Tailwind 4 + TanStack Query + React Router. Экраны один в один с утверждёнными концептами в Claude Design.

## Запуск

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

По умолчанию приложение работает на **моках в браузере** (`.env.development` → `VITE_USE_MOCKS=true`), бэкенд не нужен. Чтобы ходить в настоящий API:

```bash
# frontend/.env.development.local (не коммитится)
VITE_USE_MOCKS=false
VITE_API_URL=http://localhost:8000
```

Проверка типов и сборка: `npm run build`.

## Роуты

| Роут | Экран |
| --- | --- |
| `/` | Обложка: hero, счётчик 65 000+, «Jak to działa», живые аукционы |
| `/aukcje` | Каталог: фильтры, поиск, сортировка; `?widok=kolekcje`: коллекция текущего пользователя |
| `/dziela/:id` | Работа: паспорт-таймлиния, бейджи целостности и проверки, QR, блок аукциона (live по WebSocket), «Wystaw na aukcję» для владельца |
| `/dziela/:id/aukcja` | Live-аукцион, mobile-first, для двух телефонов на сцене |
| `/dodaj` | Добавление: фото → AI-описание → проверка → паспорт или красный экран |
| `/p/:id` | Публичный паспорт (сюда ведёт QR) |

## Структура

```text
src/
├── api/        types.ts (контракт), client.ts, endpoints.ts, mocks.ts
├── hooks/      useCurrentUser (демо-логин), useAuctionSocket, useNow
├── lib/        format.ts (злотые, хэши, таймеры, польские множественные), labels.ts
├── components/ Layout, UserSwitcher, LotCard, ArtworkFrame, Badges, PassportTimeline, LossAlert, QrBlock, Modal, Toast…
└── pages/      Home, Catalog, ArtworkPage, AuctionLive, AddArtwork, PublicPassport
```

Правила:
- Типы данных: только из `src/api/types.ts`. Он обязан совпадать с `backend/app/schemas.py`.
- Экраны не вызывают `fetch` напрямую, только `api.*` из `endpoints.ts`. Поэтому моки и реальный API взаимозаменяемы.
- Цвета и шрифты: только токены из `src/index.css` (`bg-ground`, `text-accent`, `font-display`…).

## Для демо

- **Красный экран:** на моках: любой файл, имя которого начинается с `lost`. На реальном бэке: `data/lost/images/lost-portrait.jpg` или фото распечатки работы из датасета потерь.
- **Сломанная цепочка:** на моках: `rodowodMock.tamper(1, 3)` в консоли браузера и обновить `/dziela/1`. На реальном бэке: `UPDATE` в базе, см. `docs/RUN.md`.
- **Два телефона:** открой `/dziela/1/aukcja` на двух устройствах под разными пользователями (переключатель в шапке на любой другой странице). В режиме моков соперница Ewa иногда перебивает ставку сама.
- **Шрифты** грузятся с Google Fonts. Если на площадке плохой интернет, проверь заранее.
