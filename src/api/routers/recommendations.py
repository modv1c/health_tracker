from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Date, cast, func, select

from src.database import get_db
from src.models import User, Nutrition, Sleep, Workouts
from src.schemas import Recommendation
from src.security import get_current_user
from src.services.targets import calculate_targets, ensure_profile_complete
from src.services.recommendations import check_sleep, check_day_sleep, check_nutrition, check_workouts

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

FRESH_SLEEP_LIMIT = timedelta(hours=48)


@router.get("/", response_model=list[Recommendation])
async def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_profile_complete(current_user)
    targets = calculate_targets(current_user)
    today = await db.scalar(select(func.current_date()))
    advice: list[dict] = []

    night_sleep = await db.scalar(
        select(Sleep)
        .where(Sleep.user_id == current_user.id, Sleep.sleep_at_day.is_(False))
        .order_by(Sleep.wake_up_at.desc())
        .limit(1)
    )

    if night_sleep is None or datetime.now(timezone.utc) - night_sleep.wake_up_at > FRESH_SLEEP_LIMIT:
        advice.append({"category": "sleep", "text": "Нет свежих данных о ночном сне. Добавьте запись о сне за последнюю ночь"})
    else:
        week_sleep = (await db.scalars(
            select(Sleep).where(
                Sleep.user_id == current_user.id,
                Sleep.sleep_at_day.is_(False),
                Sleep.id != night_sleep.id,
                Sleep.wake_up_at >= night_sleep.wake_up_at - timedelta(days=7),
                Sleep.wake_up_at < night_sleep.wake_up_at,
            )
        )).all()
        advice += [{"category": "sleep", "text": text} for text in check_sleep(night_sleep, week_sleep)]

    day_sleep = await db.scalar(
        select(Sleep)
        .where(
            Sleep.user_id == current_user.id,
            Sleep.sleep_at_day.is_(True),
            cast(Sleep.wake_up_at, Date) == today,
        )
        .limit(1)
    )
    if day_sleep:
        advice += [{"category": "sleep", "text": text} for text in check_day_sleep(day_sleep)]

    today_meals = (await db.scalars(
        select(Nutrition).where(Nutrition.user_id == current_user.id, Nutrition.date >= today)
    )).all()
    if not today_meals:
        advice.append({"category": "nutrition", "text": "Сегодня ещё нет приёмов пищи. Добавьте их, чтобы получить советы по питанию"})
    else:
        advice += [{"category": "nutrition", "text": text} for text in check_nutrition(today_meals, targets)]

    recent_workouts = (await db.scalars(
        select(Workouts).where(
            Workouts.user_id == current_user.id,
            Workouts.date >= func.now() - timedelta(days=7),
        )
    )).all()
    advice += [{"category": "workout", "text": text} for text in check_workouts(recent_workouts, current_user.current_goal)]

    return advice
