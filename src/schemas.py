from datetime import datetime, date
from typing import Annotated, ClassVar, Literal, Optional

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from src.models import Gender, ActivityLevel, Nutrition_Goal
from src.services.targets import calculate_age


Name = Annotated[str, Field(min_length=1, max_length=100)]
PositiveSmall = Annotated[int, Field(ge=1, le=1000)]


class StrictInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class NoNullUpdate(StrictInput):
    NULLABLE: ClassVar[set[str]] = set()

    @model_validator(mode="before")
    @classmethod
    def forbid_nulls(cls, data):
        if isinstance(data, dict):
            nulls = [key for key, value in data.items() if value is None and key not in cls.NULLABLE]
            if nulls:
                raise ValueError(f"Поля не могут быть null: {', '.join(nulls)}")
        return data


class UserCreate(StrictInput):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)

    @field_validator("password")
    @classmethod
    def password_bytes_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Пароль слишком длинный (максимум 72 байта)")
        return value

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    weight: int | None = None
    height: int | None = None
    gender: Gender | None = None
    birth_date: date | None = None
    activity_level: ActivityLevel | None = None
    current_goal: Nutrition_Goal | None = None
    created_at: datetime

class UserUpdate(StrictInput):
    weight: Optional[int] = Field(default=None, ge=30, le=300)
    height: Optional[int] = Field(default=None, ge=100, le=250)
    gender: Optional[Gender] = None
    birth_date: Optional[date] = None
    activity_level: Optional[ActivityLevel] = None
    current_goal: Optional[Nutrition_Goal] = None

    @field_validator("birth_date")
    @classmethod
    def birth_date_is_realistic(cls, value: date | None) -> date | None:
        if value is None:
            return value
        if value > date.today():
            raise ValueError("Дата рождения не может быть в будущем")
        if not 10 <= calculate_age(value) <= 100:
            raise ValueError("Возраст должен быть от 10 до 100 лет")
        return value


class TargetsRead(BaseModel):
    target_calories: int
    target_protein_g: int
    target_fat_g: int
    target_carbs_g: int
    target_sleep_min_hours: int
    target_sleep_max_hours: int
    target_goal: Nutrition_Goal

WeightKg = Annotated[float, Field(ge=0, le=500, description="кг; null — собственный вес")]


class WorkoutsCreate(StrictInput):
    workout_name: Name
    reps: PositiveSmall
    sets: int = Field(ge=1, le=100)
    to_failure: bool
    workout_time: int = Field(ge=1, le=600, description="минуты")
    time_between_sets: int = Field(ge=0, le=1800, description="секунды")
    weight_kg: Optional[WeightKg] = None

    @field_validator("weight_kg")
    @classmethod
    def round_weight(cls, value: float | None) -> float | None:
        return None if value is None else round(value, 2)

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
    weight_kg: float | None
    date: datetime

class WorkoutsUpdate(NoNullUpdate):
    NULLABLE = {"weight_kg"}

    workout_name: Optional[Name] = None
    reps: Optional[PositiveSmall] = None
    sets: Optional[int] = Field(default=None, ge=1, le=100)
    to_failure: Optional[bool] = None
    workout_time: Optional[int] = Field(default=None, ge=1, le=600)
    time_between_sets: Optional[int] = Field(default=None, ge=0, le=1800)
    weight_kg: Optional[WeightKg] = None

    @field_validator("weight_kg")
    @classmethod
    def round_weight(cls, value: float | None) -> float | None:
        return None if value is None else round(value, 2)

class NutritionCreate(StrictInput):
    meal_name: Name
    calories: int = Field(ge=0, le=10000)
    protein: int = Field(ge=0, le=1000)
    fats: int = Field(ge=0, le=1000)
    carbs: int = Field(ge=0, le=1000)

class NutritionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    meal_name: str
    calories: int
    protein: int
    fats: int
    carbs: int
    date: datetime

class NutritionUpdate(NoNullUpdate):
    meal_name: Optional[Name] = None
    calories: Optional[int] = Field(default=None, ge=0, le=10000)
    protein: Optional[int] = Field(default=None, ge=0, le=1000)
    fats: Optional[int] = Field(default=None, ge=0, le=1000)
    carbs: Optional[int] = Field(default=None, ge=0, le=1000)

MAX_SLEEP_HOURS = 24


def validate_sleep_interval(go_to_bed_at: datetime, wake_up_at: datetime) -> None:
    if wake_up_at <= go_to_bed_at:
        raise ValueError("Время подъёма должно быть позже времени отхода ко сну")
    if (wake_up_at - go_to_bed_at).total_seconds() > MAX_SLEEP_HOURS * 3600:
        raise ValueError("Сон не может длиться больше 24 часов")
    if wake_up_at > datetime.now(wake_up_at.tzinfo):
        raise ValueError("Время подъёма не может быть в будущем")


class SleepCreate(StrictInput):
    go_to_bed_at: AwareDatetime
    wake_up_at: AwareDatetime
    sleep_at_day: bool
    nap_hours_before_bed: int = Field(ge=0, le=12)
    hours_since_last_meal: int = Field(ge=0, le=24)

    @model_validator(mode="after")
    def check_interval(self):
        validate_sleep_interval(self.go_to_bed_at, self.wake_up_at)
        return self

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

class SleepUpdate(NoNullUpdate):
    go_to_bed_at: Optional[AwareDatetime] = None
    wake_up_at: Optional[AwareDatetime] = None
    sleep_at_day: Optional[bool] = None
    nap_hours_before_bed: Optional[int] = Field(default=None, ge=0, le=12)
    hours_since_last_meal: Optional[int] = Field(default=None, ge=0, le=24)


class SummaryRead(BaseModel):
    workouts_this_week: int
    avg_calories_per_day: float
    avg_hours_of_sleep: float


class DailyStat(BaseModel):
    day: date
    calories: int
    protein: int
    workouts: int
    sleep_hours: float | None


class ExerciseProgress(BaseModel):
    exercise: str
    records: int
    best_weight: float | None
    first_weight: float | None
    last_weight: float | None
    last_date: datetime


class Recommendation(BaseModel):
    category: Literal["sleep", "nutrition", "workout"]
    text: str


class Token(BaseModel):
    access_token: str
    token_type: str
