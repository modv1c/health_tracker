from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database import get_db
from src.models import User, Nutrition
from src.schemas import NutritionCreate, NutritionRead, NutritionUpdate
from src.security import get_current_user
from src.redis_client import invalidate_user_stats

router = APIRouter(prefix="/nutrition", tags=["nutrition"])

async def get_nutrition_or_404(nutrition_id: int, current_user: User, db: AsyncSession) -> Nutrition:
    query = select(Nutrition).where(Nutrition.id == nutrition_id, Nutrition.user_id == current_user.id)
    result = await db.execute(query)
    nutrition = result.scalar_one_or_none()
    
    if nutrition is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись питания не найдена")
    
    return nutrition

@router.post("/", response_model=NutritionRead, status_code=status.HTTP_201_CREATED)
async def create_nutrition(
    nutrition_data: NutritionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_nutrition = Nutrition(
        **nutrition_data.model_dump(),
        user_id = current_user.id
    )
    
    db.add(new_nutrition)
    await db.commit()
    await invalidate_user_stats(current_user.id)
    await db.refresh(new_nutrition)
    
    return new_nutrition
    
@router.get("/", response_model=list[NutritionRead])
async def get_all_nutrition(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Nutrition).where(Nutrition.user_id == current_user.id).order_by(Nutrition.date.desc())
    result = await db.execute(query)
    nutrition = result.scalars().all()
    
    return nutrition

@router.get("/{nutrition_id}", response_model=NutritionRead)
async def get_nutrition(
    nutrition_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_nutrition_or_404(nutrition_id, current_user, db)

@router.delete("/{nutrition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_nutrition(
    nutrition_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    nutrition = await get_nutrition_or_404(nutrition_id, current_user, db)
    await db.delete(nutrition)
    await db.commit()
    await invalidate_user_stats(current_user.id)
    
@router.patch("/{nutrition_id}", response_model=NutritionRead)
async def update_nutrition(
    nutrition_id: int,
    nutrition_data: NutritionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    nutrition = await get_nutrition_or_404(nutrition_id, current_user, db)
    
    update_data = nutrition_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(nutrition, key, value)

    await db.commit()
    await invalidate_user_stats(current_user.id)
    await db.refresh(nutrition)
    
    return nutrition