from datetime import datetime
from sqlalchemy import ForeignKey, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.database import Base
import enum

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
    nutrition_goal: Mapped[Nutrition_Goal] = mapped_column()
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