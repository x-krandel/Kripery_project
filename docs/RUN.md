# Запуск тестовой среды

Нужно: Docker Desktop (запущен), Node 20+.

## 1. Переменные окружения (один раз)

```bash
cp .env.example .env                       # бэкенд и docker compose
printf 'VITE_USE_MOCKS=false\nVITE_API_URL=http://localhost:8000\n' > frontend/.env.development.local
```

Оба файла в `.gitignore`, в git они не попадают. Секретов сейчас не нужно:
`LLM_API_KEY` пока не используется (провайдер AI не подключён, форма просто остаётся пустой).

## 2. База и бэкенд (Docker)

```bash
docker compose up -d --build                                  # первый раз 5–10 мин: torch + модель CLIP
docker compose logs -f backend                                # ждём "Application startup complete"
docker compose exec backend python -m scripts.index_lost      # датасет потерь из data/lost
docker compose exec backend python -m scripts.seed --reset    # 3 пользователя, 8 работ, 3 аукциона
```

Проверка: http://localhost:8000/docs

## 3. Фронтенд

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Без бэкенда, на моках: `VITE_USE_MOCKS=true npm run dev`.

## Сценарии для проверки

- Каталог и паспорт: `/aukcje`, `/dziela/1`, публичный паспорт `/p/1`.
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
