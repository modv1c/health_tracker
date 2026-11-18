"""Проверки того, что "кривой" ввод даёт 4xx с понятной ошибкой, а не 500."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from src.config import settings

WORKOUT = {
    "workout_name": "жим лежа",
    "reps": 8,
    "sets": 3,
    "to_failure": True,
    "workout_time": 40,
    "time_between_sets": 90,
}
MEAL = {"meal_name": "овсянка", "calories": 350, "protein": 12, "fats": 7, "carbs": 60}


def sleep_payload(bed: datetime, wake: datetime, **extra) -> dict:
    return {
        "go_to_bed_at": bed.isoformat(),
        "wake_up_at": wake.isoformat(),
        "sleep_at_day": False,
        "nap_hours_before_bed": 0,
        "hours_since_last_meal": 3,
        **extra,
    }


# ---------- Регистрация и токены ----------

@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [
    {"username": "ok_user", "email": "not-an-email", "password": "secret123"},
    {"username": "ok_user", "email": "a@example.com", "password": ""},
    {"username": "ok_user", "email": "a@example.com", "password": "x" * 73},
    {"username": "ab", "email": "a@example.com", "password": "secret123"},
    {"username": "плохое имя!", "email": "a@example.com", "password": "secret123"},
])
async def test_register_rejects_bad_input(client, payload):
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_username_and_email_from_different_users(client):
    # username совпадает с одним пользователем, email — с другим (раньше было 500)
    await client.post("/auth/register", json={"username": "user_a", "email": "a@example.com", "password": "secret123"})
    await client.post("/auth/register", json={"username": "user_b", "email": "b@example.com", "password": "secret123"})
    response = await client.post("/auth/register", json={"username": "user_a", "email": "b@example.com", "password": "secret123"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_email_is_case_insensitive(client):
    await client.post("/auth/register", json={"username": "user_a", "email": "Mail@Example.com", "password": "secret123"})
    response = await client.post("/auth/register", json={"username": "user_b", "email": "mail@example.com", "password": "secret123"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_username_is_case_insensitive(client):
    await client.post("/auth/register", json={"username": "Dimka", "email": "a@example.com", "password": "secret123"})
    response = await client.post("/auth/register", json={"username": "dimka", "email": "b@example.com", "password": "secret123"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_token_without_sub_is_401(client):
    token = jwt.encode({"foo": "bar"}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    response = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_garbage_token_is_401(client):
    response = await client.get("/auth/me", headers={"Authorization": "Bearer abc.def.ghi"})
    assert response.status_code == 401


# ---------- Тренировки и питание ----------

@pytest.mark.asyncio
@pytest.mark.parametrize("override", [
    {"reps": -5},
    {"reps": 0},
    {"reps": 10**12},
    {"workout_name": ""},
    {"workout_name": "   "},
    {"sets": "три"},
    {"user_id": 999},
])
async def test_workout_rejects_bad_input(client, auth_headers, override):
    response = await client.post("/workouts/", json={**WORKOUT, **override}, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_with_null_is_422(client, auth_headers):
    created = await client.post("/workouts/", json=WORKOUT, headers=auth_headers)
    response = await client.patch(f"/workouts/{created.json()['id']}", json={"reps": None}, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_nutrition_rejects_negative(client, auth_headers):
    response = await client.post("/nutrition/", json={**MEAL, "calories": -100}, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_missing_record_is_404(client, auth_headers):
    for path in ("/workouts/9999", "/nutrition/9999", "/sleep/9999"):
        assert (await client.get(path, headers=auth_headers)).status_code == 404
        assert (await client.delete(path, headers=auth_headers)).status_code == 404


# ---------- Сон ----------

@pytest.mark.asyncio
async def test_sleep_hours_are_calculated_by_server(client, auth_headers):
    bed = datetime.now(timezone.utc) - timedelta(hours=10)
    response = await client.post("/sleep/", json=sleep_payload(bed, bed + timedelta(hours=7, minutes=40)), headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["hours_of_sleep"] == 8


@pytest.mark.asyncio
async def test_sleep_rejects_bad_intervals(client, auth_headers):
    now = datetime.now(timezone.utc)
    cases = [
        sleep_payload(now - timedelta(hours=2), now - timedelta(hours=5)),       # подъём раньше отхода
        sleep_payload(now - timedelta(hours=30), now - timedelta(hours=1)),      # больше 24 часов
        sleep_payload(now + timedelta(hours=1), now + timedelta(hours=8)),       # сон в будущем
        sleep_payload(now - timedelta(hours=1), now + timedelta(hours=6)),       # подъём в будущем
        {**sleep_payload(now - timedelta(hours=9), now - timedelta(hours=1)),    # без часового пояса
         "go_to_bed_at": "2026-11-16T23:00:00"},
        sleep_payload(now - timedelta(hours=9), now - timedelta(hours=1), hours_since_last_meal=-1),
    ]
    for payload in cases:
        response = await client.post("/sleep/", json=payload, headers=auth_headers)
        assert response.status_code == 422, payload


@pytest.mark.asyncio
async def test_sleep_partial_patch_checks_interval(client, auth_headers):
    bed = datetime.now(timezone.utc) - timedelta(hours=10)
    created = await client.post("/sleep/", json=sleep_payload(bed, bed + timedelta(hours=8)), headers=auth_headers)
    sleep_id = created.json()["id"]

    # передаём только подъём — и он раньше уже сохранённого отхода ко сну
    bad = await client.patch(f"/sleep/{sleep_id}", json={"wake_up_at": (bed - timedelta(hours=1)).isoformat()}, headers=auth_headers)
    assert bad.status_code == 422

    good = await client.patch(f"/sleep/{sleep_id}", json={"wake_up_at": (bed + timedelta(hours=6)).isoformat()}, headers=auth_headers)
    assert good.status_code == 200
    assert good.json()["hours_of_sleep"] == 6


# ---------- Профиль ----------

@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [
    {"weight": -70},
    {"height": 0},
    {"birth_date": "2030-01-01"},
    {"gender": "robot"},
])
async def test_profile_rejects_bad_input(client, auth_headers, payload):
    response = await client.patch("/auth/me", json=payload, headers=auth_headers)
    assert response.status_code == 422
