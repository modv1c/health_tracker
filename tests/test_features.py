"""Статистика, нормы, рекомендации, удаление аккаунта, CORS."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from src.models import Workouts, Nutrition, Sleep

from tests.test_validation import WORKOUT, MEAL, sleep_payload

PROFILE = {
    "weight": 75,
    "height": 180,
    "gender": "male",
    "birth_date": "2005-03-01",
    "activity_level": "moderate",
    "current_goal": "bulking",
}


@pytest.mark.asyncio
async def test_summary_with_data_and_cache_invalidation(client, auth_headers):
    await client.post("/workouts/", json=WORKOUT, headers=auth_headers)
    await client.post("/nutrition/", json=MEAL, headers=auth_headers)
    await client.post("/nutrition/", json=MEAL, headers=auth_headers)

    first = await client.get("/stats/summary", headers=auth_headers)
    assert first.status_code == 200
    assert first.json()["workouts_this_week"] == 1
    assert first.json()["avg_calories_per_day"] == 700.0

    # новая тренировка сразу видна — кэш сброшен
    await client.post("/workouts/", json=WORKOUT, headers=auth_headers)
    second = await client.get("/stats/summary", headers=auth_headers)
    assert second.json()["workouts_this_week"] == 2


@pytest.mark.asyncio
async def test_daily_stats(client, auth_headers):
    await client.post("/nutrition/", json=MEAL, headers=auth_headers)
    await client.post("/workouts/", json=WORKOUT, headers=auth_headers)

    response = await client.get("/stats/daily?days=7", headers=auth_headers)
    assert response.status_code == 200
    days = response.json()
    assert len(days) == 7
    assert days[-1]["calories"] == 350
    assert days[-1]["workouts"] == 1
    assert days[0]["calories"] == 0

    assert (await client.get("/stats/daily?days=0", headers=auth_headers)).status_code == 422
    assert (await client.get("/stats/daily?days=500", headers=auth_headers)).status_code == 422


@pytest.mark.asyncio
async def test_targets_need_full_profile(client, auth_headers):
    assert (await client.get("/auth/me/targets", headers=auth_headers)).status_code == 400

    await client.patch("/auth/me", json=PROFILE, headers=auth_headers)
    response = await client.get("/auth/me/targets", headers=auth_headers)
    assert response.status_code == 200
    targets = response.json()
    assert targets["target_protein_g"] == round(75 * 1.8)
    assert targets["target_carbs_g"] >= 0


@pytest.mark.asyncio
async def test_recommendations(client, auth_headers):
    assert (await client.get("/recommendations/", headers=auth_headers)).status_code == 400

    await client.patch("/auth/me", json=PROFILE, headers=auth_headers)
    bed = datetime.now(timezone.utc) - timedelta(hours=8)
    await client.post("/sleep/", json=sleep_payload(bed, bed + timedelta(hours=5), hours_since_last_meal=1), headers=auth_headers)
    await client.post("/nutrition/", json=MEAL, headers=auth_headers)

    response = await client.get("/recommendations/", headers=auth_headers)
    assert response.status_code == 200
    advice = response.json()
    categories = {item["category"] for item in advice}
    assert categories == {"sleep", "nutrition"}
    texts = " ".join(item["text"] for item in advice)
    assert "7 часов" in texts          # спал 5 часов
    assert "2 часа до сна" in texts    # ел за час до сна
    assert "белка" in texts            # 12 г белка из ~135


@pytest.mark.asyncio
async def test_delete_account_cascades(client, auth_headers, db_session):
    await client.post("/workouts/", json=WORKOUT, headers=auth_headers)
    await client.post("/nutrition/", json=MEAL, headers=auth_headers)
    bed = datetime.now(timezone.utc) - timedelta(hours=9)
    await client.post("/sleep/", json=sleep_payload(bed, bed + timedelta(hours=8)), headers=auth_headers)

    assert (await client.delete("/auth/me", headers=auth_headers)).status_code == 204
    assert (await client.get("/auth/me", headers=auth_headers)).status_code == 401

    for model in (Workouts, Nutrition, Sleep):
        assert await db_session.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.asyncio
async def test_cors_preflight(client):
    response = await client.options(
        "/auth/me",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
