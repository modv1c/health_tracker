from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database import get_db
from src.models import User, Sleep
from src.schemas import SleepCreate, SleepRead, SleepUpdate
from src.security import get_current_user

router = APIRouter(prefix="/sleep", tags=["sleep"])

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
        user_id = current_user.id
    )
    
    db.add(new_sleep)
    await db.commit()
    await db.refresh(new_sleep)
    
    return new_sleep

@router.get("/", response_model=list[SleepRead])
async def get_all_sleep(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Sleep).where(Sleep.user_id == current_user.id).order_by(Sleep.date.desc())
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
    
@router.patch("/{sleep_id}", response_model=SleepRead)
async def update_sleep(
    sleep_id: int,
    sleep_data: SleepUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    sleep = await get_sleep_or_404(sleep_id, current_user, db)
    
    update_data = sleep_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sleep, key, value)
    
    await db.commit()
    await db.refresh(sleep)
    
    return sleep