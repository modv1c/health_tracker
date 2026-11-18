# Health Tracker

Трекер здоровья: тренировки, питание, сон, нормы КБЖУ и персональные рекомендации.

- **Бэкенд:** FastAPI + SQLAlchemy (async) + PostgreSQL + Redis + Alembic + JWT
- **Фронтенд:** React + TypeScript + Vite (папка `frontend/`)

## Запуск локально

Нужны запущенные PostgreSQL (порт из `.env`) и Redis/Memurai (порт 6379).

**1. Бэкенд** (из папки `health_tracker`):

```bash
venv\Scripts\activate
alembic upgrade head
uvicorn src.main:app --reload
```

API: http://127.0.0.1:8000, документация Swagger: http://127.0.0.1:8000/docs

**2. Фронтенд** (во втором терминале):

```bash
cd frontend
npm install
npm run dev
```

Сайт: http://localhost:5173

Фронт обращается к `/api/...`, а Vite пересылает эти запросы на `http://127.0.0.1:8000`
(см. `frontend/vite.config.ts`). Другой адрес бэкенда можно задать в `frontend/.env`:
`BACKEND_URL=http://127.0.0.1:8001`.

## Тесты

Нужна отдельная база `health_tracker_test` (таблицы создаются и удаляются автоматически).

```bash
pytest -q
```

## Структура

```
src/
  main.py              — создание приложения, CORS, подключение роутеров
  config.py            — настройки из .env
  database.py          — подключение к БД, сессии
  models.py            — таблицы (SQLAlchemy ORM)
  schemas.py           — валидация входа/выхода (Pydantic)
  security.py          — пароли (bcrypt), JWT, текущий пользователь
  redis_client.py      — кэш статистики
  api/routers/         — эндпоинты: auth, workouts, nutrition, sleep, stats, recommendations
  services/            — расчёт норм КБЖУ и текст рекомендаций
alembic/versions/      — миграции схемы БД
tests/                 — pytest
frontend/              — сайт
```
