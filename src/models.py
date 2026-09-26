from datetime import datetime, date
from sqlalchemy import ForeignKey, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.database import Base
import enum

class Gender(enum.Enum):
    male = "male"
    female = "female"
    
class ActivityLevel(enum.Enum):
    sedentary = "sedentary"           # сидячий образ жизни, почти нет активности
    light = "light"                   # лёгкая активность, 1-3 тренировки в неделю
    moderate = "moderate"             # умеренная, 3-5 тренировок в неделю
    active = "active"                 # высокая, 6-7 тренировок в неделю
    very_active = "very_active"       # очень высокая, физическая работа + тренировки

class Nutrition_Goal(enum.Enum):
    bulking = "bulking"
    maintenance = "maintenance"
    cutting = "cutting"

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    email: Mapped[str] = mapped_column(unique=True)
    hashed_password: Mapped[str] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    weight: Mapped[int | None] = mapped_column(default=None)
    height: Mapped[int | None] = mapped_column(default=None)
    
    gender: Mapped[Gender | None] = mapped_column(default=None)
    birth_date: Mapped[date | None] = mapped_column(default=None)
    activity_level: Mapped[ActivityLevel | None] = mapped_column(default=None)
    current_goal: Mapped[Nutrition_Goal | None] = mapped_column(default=None)
    workouts: Mapped[list["Workouts"]] = relationship(back_populates="user")
    nutrition: Mapped[list["Nutrition"]] = relationship(back_populates="user")
    sleep: Mapped[list["Sleep"]] = relationship(back_populates="user")
    
class Workouts(Base):
    __tablename__ = "workouts"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    workout_name: Mapped[str] = mapped_column()
    reps: Mapped[int] = mapped_column()
    sets: Mapped[int] = mapped_column()
    to_failure: Mapped[bool] = mapped_column() 
    workout_time: Mapped[int] = mapped_column()
    time_between_sets: Mapped[int] = mapped_column()
    date: Mapped[datetime] = mapped_column(server_default=func.now())
    
    user: Mapped["User"] = relationship(back_populates="workouts")
    
class Nutrition(Base):
    __tablename__ = "nutrition"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    meal_name: Mapped[str] = mapped_column()
    calories: Mapped[int] = mapped_column()
    protein: Mapped[int] = mapped_column()
    fats: Mapped[int] = mapped_column()
    carbs: Mapped[int] = mapped_column()
    date: Mapped[datetime] = mapped_column(server_default=func.now())
    
    user: Mapped["User"] = relationship(back_populates="nutrition")
    
class Sleep(Base):
    __tablename__ = "sleep"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    hours_of_sleep: Mapped[int] = mapped_column()
    go_to_bed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    wake_up_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sleep_at_day: Mapped[bool] = mapped_column()
    nap_hours_before_bed: Mapped[int] = mapped_column()
    hours_since_last_meal: Mapped[int] = mapped_column()
    date: Mapped[datetime] = mapped_column(server_default=func.now())
    
    user: Mapped["User"] = relationship(back_populates="sleep")