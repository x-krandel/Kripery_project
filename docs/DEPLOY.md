# Деплой в Azure App Service

Два приложения, оба деплоятся GitHub Actions при пуше в `krandel`:

| App Service | Что | Workflow |
|---|---|---|
| `kripers-backend-python` | FastAPI (API + WebSocket + `/media`) | `.github/workflows/krandel_kripers-backend-python.yml` |
| `project-backend-nodejs` | фронтенд: `npm run build`, затем `npm start` → `frontend/server.js` | `.github/workflows/krandel_project-backend-nodejs.yml` |

Что делают workflow:
- Бэкенд: ставит зависимости (torch только CPU), проверяет, что `app.main` импортируется. Кладёт `data/` внутрь `backend/` (датасет потерь и демо-картинки). Венв в артефакт не попадает, App Service собирает свой. Стартовая команда задаётся из workflow: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1`. Воркер ровно один: ставки и WebSocket живут в памяти процесса.
- Фронтенд: собирает с `VITE_USE_MOCKS=false`. `server.js` отдаёт `dist/`, а на любой маршрут вроде `/dziela/1` отвечает `index.html`. Зависимости ему не нужны.

## Настройки в портале (один раз)

### Бэкенд: kripers-backend-python

**Settings → Environment variables (App settings):**

| Переменная | Значение |
|---|---|
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` (App Service сам ставит `requirements.txt`) |
| `AUTO_SEED` | `true`: при старте заполнит пустую базу, см. ниже |
| `CORS_ORIGINS` | адрес фронтенда, например `https://project-backend-nodejs.azurewebsites.net` (точный адрес: Overview → Default domain) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Azure PostgreSQL, подробно в `backend-notes.md`, раздел 14 |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Azure OpenAI, как в `.env` |
| `LOSS_MATCH_THRESHOLD` | `0.95` |

`MEDIA_DIR` и кэш модели CLIP на App Service по умолчанию лежат в `/home/media` и `/home/hfcache`. Эти папки переживают перезапуск.

**Settings → Configuration → General settings:** `Web sockets` = On, `Always on` = On (иначе через 20 минут простоя процесс засыпает вместе с таймерами аукционов).

**Тариф:** не ниже B1, лучше B2. CLIP вместе с torch занимает около 1–1,5 ГБ памяти, первый старт качает модель примерно минуту.

### Фронтенд: project-backend-nodejs

**App settings:** `API_URL` = адрес бэкенда, например `https://kripers-backend-python.azurewebsites.net` (Default domain из Overview бэкенда). Пересборка не нужна: `server.js` отдаёт этот адрес в `/env.js`.

Можно вместо этого задать адрес при сборке: GitHub → Settings → Secrets and variables → Actions → Variables → `VITE_API_URL`.

## Данные на сервере (AUTO_SEED)

С `AUTO_SEED=true` бэкенд после старта в фоне:
1. докладывает в `MEDIA_DIR` недостающие картинки из `data/` (на случай, если базу сидили с ноутбука);
2. индексирует датасет потерь, если таблица `lost_artworks` пустая;
3. запускает сид (3 аккаунта демо, 8 работ, 3 аукциона), если в базе нет пользователей.

Удаления в этом процессе нет: заполненную базу он не трогает. Чтобы начать заново (новые таймеры аукционов), очистите базу по договорённости в чате (`seed --reset` с ноутбука, `DB_HOST` при этом указывает на Azure) и перезапустите бэкенд в портале: картинки он доложит сам.

## Проверка после деплоя

- `https://<бэкенд>/api/health` → `{"ok":true}`; `https://<бэкенд>/docs` открывается.
- `https://<бэкенд>/api/artworks` возвращает 8 работ (сид прошёл; первый раз подождите пару минут после старта).
- Фронтенд: каталог с картинками, вход `anna / demo1234`, ставка на `/dziela/1/aukcja` с двух устройств.
- Если в консоли браузера ошибка CORS, проверьте, что в `CORS_ORIGINS` бэкенда стоит точный адрес фронтенда с `https://` и без `/` на конце.
- Логи: App Service → Log stream.
