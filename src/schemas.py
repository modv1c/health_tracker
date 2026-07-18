from pydantic import BaseModel, ConfigDict
from datetime import datetime
from src.models import Nutrition_Goal

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    
class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    username: str
    email: str
    weight: int | None = None
    height: int | None = None
    created_at: datetime
    
class WorkoutsCreate(BaseModel):
    workout_name: str
    reps: int
    sets: int
    to_failure: bool
    workout_time: int
    time_between_sets: int
    
class WorkoutsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    workout_name: str
    reps: int
    sets: int
    to_failure: bool
    workout_time: int
    time_between_sets: int
    date: datetime
    
class NutritionCreate(BaseModel):
    meal_name: str
    calories: int
    protein: int
    fats: int
    carbs: int
    nutrition_goal: Nutrition_Goal
    
class NutritionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    meal_name: str
    calories: int
    protein: int
    fats: int
    carbs: int
    nutrition_goal: Nutrition_Goal
    date: datetime
    
class SleepCreate(BaseModel):
    hours_of_sleep: int
    go_to_bed_at: datetime
    wake_up_at: datetime
    sleep_at_day: bool
    nap_hours_before_bed: int
    hours_since_last_meal: int
    
class SleepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    hours_of_sleep: int
    go_to_bed_at: datetime
    wake_up_at: datetime
    sleep_at_day: bool
    nap_hours_before_bed: int
    hours_since_last_meal: int
    date: datetime
    
class Token(BaseModel):
    access_token: str
    token_type: str