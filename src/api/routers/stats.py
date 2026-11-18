from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import User, Workouts, Nutrition, Sleep
from src.redis_client import cache_get, cache_set, stats_cache_key
from src.schemas import SummaryRead, DailyStat
from src.security import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


def to_float(value) -> float:
    return round(float(value), 1) if value is not None else 0.0


@router.get("/summary", response_model=SummaryRead)
async def get_weekly_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cache_key = stats_cache_key(current_user.id)
    cached = await cache_get(cache_key)
    if cached:
        return cached

    week_ago = func.now() - timedelta(days=7)

    workouts_count = await db.scalar(
        select(func.count(Workouts.id)).where(
            Workouts.user_id == current_user.id,
            Workouts.date >= week_ago,
        )
    )

    calories_per_day = (
        select(func.sum(Nutrition.calories).label("total"))
        .where(Nutrition.user_id == current_user.id, Nutrition.date >= week_ago)
        .group_by(cast(Nutrition.date, Date))
        .subquery()
    )
    avg_calories = await db.scalar(select(func.avg(calories_per_day.c.total)))

    avg_sleep = await db.scalar(
        select(func.avg(Sleep.hours_of_sleep)).where(
            Sleep.user_id == current_user.id,
            Sleep.sleep_at_day.is_(False),
            Sleep.wake_up_at >= week_ago,
        )
    )

    result = {
        "workouts_this_week": workouts_count or 0,
        "avg_calories_per_day": to_float(avg_calories),
        "avg_hours_of_sleep": to_float(avg_sleep),
    }

    await cache_set(cache_key, result)
    return result


@router.get("/daily", response_model=list[DailyStat])
async def get_daily_stats(
    days: int = Query(default=7, ge=1, le=31),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = await db.scalar(select(func.current_date()))
    first_day = today - timedelta(days=days - 1)

    nutrition_day = cast(Nutrition.date, Date)
    nutrition_rows = await db.execute(
        select(nutrition_day, func.sum(Nutrition.calories), func.sum(Nutrition.protein))
        .where(Nutrition.user_id == current_user.id, Nutrition.date >= first_day)
        .group_by(nutrition_day)
    )
    nutrition_by_day = {day: (int(cal), int(prot)) for day, cal, prot in nutrition_rows}

    workout_day = cast(Workouts.date, Date)
    workout_rows = await db.execute(
        select(workout_day, func.count(Workouts.id))
        .where(Workouts.user_id == current_user.id, Workouts.date >= first_day)
        .group_by(workout_day)
    )
    workouts_by_day = dict(workout_rows.all())

    sleep_day = cast(Sleep.wake_up_at, Date)
    sleep_rows = await db.execute(
        select(sleep_day, func.sum(Sleep.hours_of_sleep))
        .where(Sleep.user_id == current_user.id, Sleep.wake_up_at >= first_day)
        .group_by(sleep_day)
    )
    sleep_by_day = {day: float(hours) for day, hours in sleep_rows}

    result = []
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        calories, protein = nutrition_by_day.get(day, (0, 0))
        result.append({
            "day": day,
            "calories": calories,
            "protein": protein,
            "workouts": workouts_by_day.get(day, 0),
            "sleep_hours": sleep_by_day.get(day),
        })
    return result
