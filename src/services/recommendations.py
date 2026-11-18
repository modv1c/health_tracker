from datetime import datetime

from src.models import Sleep, Nutrition, Nutrition_Goal, Workouts

SLEEP_MEAL_GAP_HOURS = 2
MIN_SLEEP_HOURS = 7
MAX_SLEEP_HOURS = 9
LATE_BEDTIME_HOUR = 23
WAKE_UP_DEVIATION_MIN = 60
PROTEIN_THRESHOLD = 0.9      # 90% от нормы — порог для совета
CALORIE_OVERAGE_LIMIT = 1.1  # 110% от нормы на похудении — предупреждение
CALORIE_FAILURE_LIMIT = 0.9


def local(moment: datetime) -> datetime:
    return moment.astimezone()


def minutes_of_day(moment: datetime) -> int:
    moment = local(moment)
    return moment.hour * 60 + moment.minute


def check_sleep(sleep: Sleep, week_sleep: list[Sleep]) -> list[str]:
    advice = []

    if sleep.hours_of_sleep < MIN_SLEEP_HOURS:
        advice.append("В следующий раз постарайся поспать хотя бы 7 часов. Если получается так, что ты приходишь домой позже обычного и не успеваешь лечь вовремя (отмечал день рождения друга), то постарайся проснуться в то же время, в которое всегда встаёшь. Это нужно для того, чтобы сохранять стабильные циркадные ритмы и не портить внутренние биологические часы")
    if sleep.hours_of_sleep > MAX_SLEEP_HOURS:
        advice.append("Старайся не спать больше положенного времени. Сон больше 9 часов повышает риск проблем со здоровьем и может быть признаком скрытых болезней")

    if sleep.hours_since_last_meal < SLEEP_MEAL_GAP_HOURS:
        advice.append("Ты поел меньше чем за 2 часа до сна — это может ухудшить качество сна. В следующий раз постарайся оставить хотя бы пару часов между последним приёмом пищи и отходом ко сну")

    bed_hour = local(sleep.go_to_bed_at).hour
    if bed_hour < 5 or bed_hour >= LATE_BEDTIME_HOUR:
        advice.append("Ты лёг спать позже 23:00. Постарайся укладываться раньше: пик выработки мелатонина («гормона сна») приходится на 22:00–02:00, и он отвечает за глубокую фазу сна и качественное восстановление")

    if sleep.nap_hours_before_bed > 0:
        advice.append("Перед этим сном ты спал днём — из-за этого труднее заснуть вечером. Если чувствуешь усталость, лучше ограничиться 20–30 минутами дневного сна")

    if week_sleep:
        usual_wake_up = sum(minutes_of_day(record.wake_up_at) for record in week_sleep) / len(week_sleep)
        if abs(usual_wake_up - minutes_of_day(sleep.wake_up_at)) > WAKE_UP_DEVIATION_MIN:
            advice.append("Сегодня ты проснулся не как обычно. Старайся просыпаться в одно и то же время, потому что это настраивает внутренние биологические часы и улучшает работу всего организма")

    return advice


def check_day_sleep(day_sleep: Sleep) -> list[str]:
    advice = ["Постарайся не спать днём: дневной сон может сбивать выработку мелатонина к вечеру и мешать быстро заснуть ночью, из-за чего страдает основной ночной сон"]
    if day_sleep.hours_of_sleep >= 2:
        advice.append("Дневной сон дольше пары часов особенно сильно сбивает режим. Если без него никак — ставь будильник на 20–30 минут")
    return advice


def check_nutrition(today_meals: list[Nutrition], targets: dict) -> list[str]:
    advice = []

    total_calories = sum(meal.calories for meal in today_meals)
    total_protein = sum(meal.protein for meal in today_meals)

    if total_protein < targets["target_protein_g"] * PROTEIN_THRESHOLD:
        missing = targets["target_protein_g"] - total_protein
        advice.append(f"До нормы белка не хватает примерно {missing} г — добавь белковый перекус (творог, яйца, протеин)")

    if targets["target_goal"] == Nutrition_Goal.cutting and total_calories > targets["target_calories"] * CALORIE_OVERAGE_LIMIT:
        advice.append("Ты превысил суточную норму калорий больше чем на 10% — для похудения это многовато, постарайся не переедать завтра")

    if targets["target_goal"] == Nutrition_Goal.bulking and total_calories < targets["target_calories"] * CALORIE_FAILURE_LIMIT:
        missing = targets["target_calories"] - total_calories
        advice.append(f"До нормы для набора массы не хватает примерно {missing} ккал. Добавь калорийный перекус: орехи, бублики, гейнер, творог с мёдом. Для углеводов подойдут каши, бананы, зефир")

    if targets["target_goal"] == Nutrition_Goal.maintenance and total_calories > targets["target_calories"] * CALORIE_OVERAGE_LIMIT:
        advice.append("Сегодня калорий заметно больше нормы для поддержания веса — завтра можно сделать рацион чуть легче")

    return advice


HYPERTROPHY_MIN_REPS = 9
HYPERTROPHY_MAX_REPS = 13


def check_workouts(recent_workouts: list[Workouts], goal: Nutrition_Goal) -> list[str]:
    advice = []

    if goal == Nutrition_Goal.bulking:
        too_light = list(dict.fromkeys(
            w.workout_name for w in recent_workouts if w.reps > HYPERTROPHY_MAX_REPS
        ))
        if too_light:
            names = ", ".join(f"«{name}»" for name in too_light[:3])
            advice.append(
                f"Для набора мышечной массы больше {HYPERTROPHY_MAX_REPS} повторений — слишком лёгкий вес ({names}). "
                f"Такая нагрузка не даёт мышцам стимула к росту. Увеличь вес так, чтобы в отказ выходило "
                f"{HYPERTROPHY_MIN_REPS}–{HYPERTROPHY_MAX_REPS} повторений (в упражнениях с собственным весом — добавь отягощение)"
            )

    return advice
