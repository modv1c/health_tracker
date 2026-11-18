from datetime import date

from fastapi import HTTPException, status
from src.models import Gender, ActivityLevel, Nutrition_Goal, User


ACTIVITY_MULTIPLIERS = {
    ActivityLevel.sedentary: 1.2,
    ActivityLevel.light: 1.375,
    ActivityLevel.moderate: 1.55,
    ActivityLevel.active: 1.725,
    ActivityLevel.very_active: 1.9,
}

GOAL_CALORIE_ADJUSTMENT = {
    Nutrition_Goal.bulking: 400,
    Nutrition_Goal.maintenance: 0,
    Nutrition_Goal.cutting: -400,
}

PROTEIN_PER_KG = {
    Nutrition_Goal.bulking: 1.8,
    Nutrition_Goal.maintenance: 1.6,
    Nutrition_Goal.cutting: 2.2,
}

FAT_PER_KG = 1.0

PROFILE_FIELDS = ("weight", "height", "gender", "birth_date", "activity_level", "current_goal")


def ensure_profile_complete(user: User) -> None:
    missing = [field for field in PROFILE_FIELDS if getattr(user, field) is None]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала заполните профиль: вес, рост, пол, дату рождения, активность и цель",
        )

def calculate_age(birth_date: date) -> int:
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def calculate_bmr(weight: int, height: int, age: int, gender: Gender) -> float:
    base = 10 * weight + 6.25 * height - 5 * age
    if gender == Gender.male:
        return base + 5
    return base - 161


def calculate_tdee(bmr: float, activity_level: ActivityLevel) -> float:
    return bmr * ACTIVITY_MULTIPLIERS[activity_level]


def calculate_targets(user: User) -> dict:
    age = calculate_age(user.birth_date)
    bmr = calculate_bmr(user.weight, user.height, age, user.gender)
    tdee = calculate_tdee(bmr, user.activity_level)

    target_calories = round(tdee + GOAL_CALORIE_ADJUSTMENT[user.current_goal])

    protein_g = round(user.weight * PROTEIN_PER_KG[user.current_goal])
    protein_kcal = protein_g * 4

    fat_g = round(user.weight * FAT_PER_KG)
    fat_kcal = fat_g * 9

    carbs_kcal = max(target_calories - protein_kcal - fat_kcal, 0)
    carbs_g = round(carbs_kcal / 4)

    return {
        "target_calories": target_calories,
        "target_protein_g": protein_g,
        "target_fat_g": fat_g,
        "target_carbs_g": carbs_g,
        "target_sleep_min_hours": 7,
        "target_sleep_max_hours": 9,
        "target_goal": user.current_goal,
    }