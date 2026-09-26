from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database import get_db
from src.models import User, Nutrition, Sleep
from src.security import get_current_user
from src.services.targets import calculate_targets
from src.services.recommendations import check_sleep, check_nutrition

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

@router.get("/")
async def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    requires_fields = [
        current_user.weight,
        current_user.height,
        current_user.gender,
        current_user.birth_date,
        current_user.activity_level,
        current_user.current_goal,
    ]
    if any(field is None for field in requires_fields):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала заполните профиль (вес, рост, пол, дату рождения, активность и цель) через PATCH /auth/me",
        )
    targets = calculate_targets(current_user)
    
    query = (
        select(Sleep)
        .where(Sleep.user_id == current_user.id, Sleep.sleep_at_day.is_(False))
        .order_by(Sleep.date.desc())
        .limit(1)
    )
    result = await db.execute(query)
    sleep = result.scalar_one_or_none()
    
    today_start = datetime.combine(date.today(), datetime.min.time())
    week_ago = today_start - timedelta(days=7)
    
    query = (
        select(Sleep)
        .where(Sleep.user_id == current_user.id, Sleep.date >= week_ago, Sleep.date < today_start, Sleep.sleep_at_day.is_(False))
    )
    result = await db.execute(query)
    week_sleep = result.scalars().all()
    
    if sleep is None:
        advice_sleep = ["Недостаточно данных для рекомендаций по сну. Добавьте запись о сне"]
    else:
        advice_sleep = check_sleep(sleep, week_sleep)
    
    query = (
        select(Nutrition)
        .where(Nutrition.user_id == current_user.id, Nutrition.date >= today_start)
    )
    result = await db.execute(query)
    today_meals = result.scalars().all()
    if not today_meals:
        advice_nutrition = ["Недостаточно данных для рекомендаций по питанию. Добавьте приёмы пищи за сегодня"]
    else:
        advice_nutrition = check_nutrition(today_meals, targets)
    
    return advice_sleep + advice_nutrition
    