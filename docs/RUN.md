# Запуск тестовой среды

Нужно: Docker Desktop (запущен), Node 20+.

## 1. Переменные окружения (один раз)

```bash
cp .env.example .env                       # бэкенд и docker compose
printf 'VITE_USE_MOCKS=false\nVITE_API_URL=http://localhost:8000\n' > frontend/.env.development.local
```

Оба файла в `.gitignore`, в git они не попадают.

**AI-автозаполнение (Azure OpenAI)** — необязательно, без ключа форма просто остаётся пустой. В `.env`:

```bash
LLM_API_KEY=<ключ из Azure: ресурс kripery-project → Keys and Endpoint>
LLM_BASE_URL=https://kripery-project.openai.azure.com/openai/v1
LLM_MODEL=<имя деплоймента в Azure AI Foundry, например gpt-4o-mini>
```

Ключ не коммитить и не присылать в чаты. После изменения `.env`: `docker compose up -d`.

## 2. База и бэкенд (Docker)

```bash
docker compose up -d --build                                  # первый раз 5–10 мин: torch + модель CLIP
docker compose logs -f backend                                # ждём "Application startup complete"
docker compose exec backend python -m scripts.index_lost      # датасет потерь из data/lost
docker compose exec backend python -m scripts.seed --reset    # 3 пользователя, 8 работ, 3 аукциона
```

Проверка: http://localhost:8000/docs

**Сид всегда в локальный контейнер.** `seed --reset` пересоздаёт таблицы. Если в `.env` настроена общая база в Azure, запускайте его только по договорённости в чате.

**Проверка порога потерь.** После сида все 8 работ из каталога должны быть опубликованы:

```bash
curl -s "localhost:8000/api/artworks?ownerId=1" | python3 -c "import json,sys; [print(a['status'], a['title']) for a in json.load(sys.stdin)]"
```

Если какая-то работа `held` (на картинках-заглушках портреты похожи на «Portret młodzieńca»), поднимите `LOSS_MATCH_THRESHOLD` в `.env` выше её сходства (по умолчанию уже 0.95), затем `docker compose up -d` и снова сид. Загрузка самого `lost-portrait.jpg` даёт сходство около 1.0, красный экран останется.

## 3. Фронтенд

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Без бэкенда, на моках: `VITE_USE_MOCKS=true npm run dev`.

## Сценарии для проверки

- Каталог и паспорт: `/aukcje`, `/dziela/1`, публичный паспорт `/p/1`.
- Новые экраны: `/szukamy` (индекс потерь), `/kolekcje` (коллекции как выставки), «Dodaj wpis» на странице своей работы.
- Красный экран: «Dodaj dzieło» → загрузить `data/lost/images/lost-portrait.jpg`, ввести название, «Zapisz i sprawdź».
- Ставки: открыть `/dziela/1/aukcja` в двух вкладках, во второй сменить пользователя (Piotr ↔ Ewa) на любой другой странице.
- «Сломанная» история (шаг 5 демо): меняем запись паспорта в базе в обход API, потом обновляем `/dziela/1`:
  `docker compose exec db psql -U rodowod -c "UPDATE passport_events SET description = description || ' (zmienione)' WHERE artwork_id = 1 AND seq = 2;"`
  Вернуть как было: тот же UPDATE с `replace(description, ' (zmienione)', '')` или `seed --reset`.
- Аукционы из сида заканчиваются через 5, 30 и 120 минут. Перезапуск: `docker compose exec backend python -m scripts.seed --reset`.

## Остановить

```bash
docker compose down        # остановить
docker compose down -v     # остановить и стереть базу
```
