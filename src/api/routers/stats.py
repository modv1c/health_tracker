import json
  
from src.redis_client import redis_client    

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import User, Workouts, Nutrition, Sleep
from src.security import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary")
async def get_weekly_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"stats_summary:{current_user.id}"

    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    week_ago = datetime.now() - timedelta(days=7)

    workouts_count = await db.scalar(
        select(func.count(Workouts.id)).where(
            Workouts.user_id == current_user.id,
            Workouts.date >= week_ago,
        )
    )

    avg_calories = await db.scalar(
        select(func.avg(Nutrition.calories)).where(
            Nutrition.user_id == current_user.id,
            Nutrition.date >= week_ago,
        )
    )

    avg_sleep = await db.scalar(
        select(func.avg(Sleep.hours_of_sleep)).where(
            Sleep.user_id == current_user.id,
            Sleep.date >= week_ago,
        )
    )

    result = {
        "workouts_this_week": workouts_count or 0,
        "avg_calories_per_meal": round(avg_calories, 1) if avg_calories else 0,
        "avg_hours_of_sleep": round(avg_sleep, 1) if avg_sleep else 0,
    }

    await redis_client.set(cache_key, json.dumps(result), ex=60)

    return result