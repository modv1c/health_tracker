from datetime import datetime, time, timedelta

import pytest
from sqlalchemy import func, select, update

from src.models import Nutrition

MEAL = {"meal_name": "Обед", "calories": 500, "protein": 30, "fats": 10, "carbs": 60}


@pytest.mark.asyncio
async def test_summary_uses_same_week_as_daily_chart(client, auth_headers, db_session):
    old = await client.post("/nutrition/", json={**MEAL, "calories": 9000}, headers=auth_headers)
    await client.post("/nutrition/", json=MEAL, headers=auth_headers)

    # запись за 7-й день назад: на графике за неделю её нет, значит и в среднем быть не должно
    today = await db_session.scalar(select(func.current_date()))
    outside = datetime.combine(today - timedelta(days=7), time(23, 59, 59))
    await db_session.execute(update(Nutrition).where(Nutrition.id == old.json()["id"]).values(date=outside))
    await db_session.commit()

    summary = (await client.get("/stats/summary", headers=auth_headers)).json()
    daily = (await client.get("/stats/daily?days=7", headers=auth_headers)).json()

    assert summary["avg_calories_per_day"] == 500
    assert sum(day["calories"] for day in daily) == 500
