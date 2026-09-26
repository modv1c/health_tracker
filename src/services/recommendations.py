from src.models import Sleep, Nutrition, Nutrition_Goal

SLEEP_MEAL_GAP_HOURS = 2
PROTEIN_THRESHOLD = 0.9      # 90% от нормы — порог для совета
CALORIE_OVERAGE_LIMIT = 1.1  # 110% от нормы на похудении — предупреждение
CALORIE_FAILURE_LIMIT = 0.9


def check_sleep(sleep: Sleep, week_sleep: list[Sleep]) -> list[str]:
    advice = []

    if sleep.hours_of_sleep < 7:
        advice.append("В следующий раз постарайся поспать хотя бы 7 часов. Если получается так, что ты приходишь домой позже обычного и не успеваешь лечь вовремя(отмечал день рождения друга), то постарайся проснуться в то же время, в которое всегда встаёшь. Это нужно нужно для того, чтобы сохранять стабильные циркадные ритмы и не портить внутренние биологические часы")
    if sleep.hours_of_sleep > 9:
        advice.append("Старайся не спать больше положенного времени. Сон больше 9 часов повышает риск проблем со здоровьем и может быть признаком скрытых болезней")

    if sleep.hours_since_last_meal < SLEEP_MEAL_GAP_HOURS:
        advice.append("Ты поел меньше чем за 2 часа до сна — это может ухудшить качество сна. В следующий раз постарайся оставить хотя бы пару часов между последним приёмом пищи и отходом ко сну")

    if sleep.go_to_bed_at.hour < 5 or sleep.go_to_bed_at.hour >= 23:
        advice.append("Ты лёг спать уже после полуночи. Постарайся укладываться до полуночи: пик выработки мелатонина («гормона сна») приходится на 22:00–02:00, и он отвечает за глубокую фазу сна и качественное восстановление")

    if sleep.sleep_at_day:
        advice.append("Постарайся не спать днём: дневной сон может сбивать выработку мелатонина к вечеру и мешать быстро заснуть ночью, из-за чего страдает основной ночной сон")
    
    if week_sleep:
        sleep_time = []
        for record in week_sleep:
            sleep_time.append(record.wake_up_at.time().hour * 60 + record.wake_up_at.time().minute)
        avg_sleep_time = sum(sleep_time) / len(sleep_time)
        minutes_sleep_today = sleep.wake_up_at.time().hour * 60 + sleep.wake_up_at.time().minute
        if abs(avg_sleep_time - minutes_sleep_today) > 60:
            advice.append("Сегодня ты проснулся не как обычно( Старайся просыпаться в одно и то же время, потому что это настраивает внутренние биологические часы и улучшает работу всего организма")
    
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
        advice.append("Ты недобрал свой калораж, добавь в свой перекус украинские бублики, в них 700 калорий, лишними не будут. Или можешь добавить гейнер, грязный набор(печенья, пряники, вафли). Также чтобы добрать углеводы, можно покупать зефир.")

    return advice