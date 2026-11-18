from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database import get_db
from src.models import User, Sleep
from src.schemas import SleepCreate, SleepRead, SleepUpdate, validate_sleep_interval
from src.security import get_current_user
from src.redis_client import invalidate_user_stats

router = APIRouter(prefix="/sleep", tags=["sleep"])


def calculate_sleep_hours(go_to_bed_at: datetime, wake_up_at: datetime) -> int:
    seconds = (wake_up_at - go_to_bed_at).total_seconds()
    return int(seconds / 3600 + 0.5)


async def get_sleep_or_404(sleep_id: int, current_user: User, db: AsyncSession) -> Sleep:
    query = select(Sleep).where(Sleep.id == sleep_id, Sleep.user_id == current_user.id)
    result = await db.execute(query)
    sleep = result.scalar_one_or_none()

    if sleep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сон не найден")

    return sleep

@router.post("/", response_model=SleepRead, status_code=status.HTTP_201_CREATED)
async def create_sleep(
    sleep_data: SleepCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_sleep = Sleep(
        **sleep_data.model_dump(),
        hours_of_sleep=calculate_sleep_hours(sleep_data.go_to_bed_at, sleep_data.wake_up_at),
        user_id=current_user.id,
    )

    db.add(new_sleep)
    await db.commit()
    await invalidate_user_stats(current_user.id)
    await db.refresh(new_sleep)

    return new_sleep

@router.get("/", response_model=list[SleepRead])
async def get_all_sleep(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Sleep).where(Sleep.user_id == current_user.id).order_by(Sleep.wake_up_at.desc())
    result = await db.execute(query)
    sleep = result.scalars().all()
    return sleep

@router.get("/{sleep_id}", response_model=SleepRead)
async def get_sleep(
    sleep_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_sleep_or_404(sleep_id, current_user, db)

@router.delete("/{sleep_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sleep(
    sleep_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    sleep = await get_sleep_or_404(sleep_id, current_user, db)
    await db.delete(sleep)
    await db.commit()
    await invalidate_user_stats(current_user.id)

@router.patch("/{sleep_id}", response_model=SleepRead)
async def update_sleep(
    sleep_id: int,
    sleep_data: SleepUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    sleep = await get_sleep_or_404(sleep_id, current_user, db)

    update_data = sleep_data.model_dump(exclude_unset=True)

    go_to_bed_at = update_data.get("go_to_bed_at", sleep.go_to_bed_at)
    wake_up_at = update_data.get("wake_up_at", sleep.wake_up_at)
    try:
        validate_sleep_interval(go_to_bed_at, wake_up_at)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error))

    for key, value in update_data.items():
        setattr(sleep, key, value)
    sleep.hours_of_sleep = calculate_sleep_hours(go_to_bed_at, wake_up_at)

    await db.commit()
    await invalidate_user_stats(current_user.id)
    await db.refresh(sleep)

    return sleep
