from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database import get_db
from src.models import User, Workouts
from src.schemas import WorkoutsCreate, WorkoutsRead, WorkoutsUpdate
from src.security import get_current_user

router = APIRouter(prefix="/workouts", tags=["workouts"])

async def get_workout_or_404(workout_id: int, current_user: User, db: AsyncSession) -> Workouts:
    query = select(Workouts).where(Workouts.id == workout_id, Workouts.user_id == current_user.id)
    result = await db.execute(query)
    workout = result.scalar_one_or_none()

    if workout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тренировка не найдена")

    return workout


@router.post("/", response_model=WorkoutsRead, status_code=status.HTTP_201_CREATED)
async def create_workout(
    workout_data: WorkoutsCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    new_workout = Workouts(
        **workout_data.model_dump(),
        user_id = current_user.id,
    )

    db.add(new_workout)
    await db.commit()
    await db.refresh(new_workout)

    return new_workout


@router.get("/", response_model=list[WorkoutsRead])
async def get_workouts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Workouts).where(Workouts.user_id == current_user.id).order_by(Workouts.date.desc())
    result = await db.execute(query)
    workouts = result.scalars().all()
    return workouts


@router.get("/{workout_id}", response_model=WorkoutsRead)
async def get_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_workout_or_404(workout_id, current_user, db)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workout = await get_workout_or_404(workout_id, current_user, db)
    await db.delete(workout)
    await db.commit()
    
@router.patch("/{workout_id}", response_model=WorkoutsRead)
async def update_workout(
    workout_id: int,
    workout_data: WorkoutsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workout = await get_workout_or_404(workout_id, current_user, db)

    update_data = workout_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(workout, key, value)

    await db.commit()
    await db.refresh(workout)

    return workout