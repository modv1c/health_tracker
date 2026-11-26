"""Рабочий вес, прогресс по упражнениям и совет про диапазон повторений."""
import pytest

from tests.test_validation import WORKOUT
from tests.test_features import PROFILE


@pytest.mark.asyncio
async def test_weight_is_saved_and_optional(client, auth_headers):
    with_weight = await client.post("/workouts/", json={**WORKOUT, "weight_kg": 62.5}, headers=auth_headers)
    assert with_weight.status_code == 201
    assert with_weight.json()["weight_kg"] == 62.5

    bodyweight = await client.post("/workouts/", json={**WORKOUT, "workout_name": "подтягивания"}, headers=auth_headers)
    assert bodyweight.status_code == 201
    assert bodyweight.json()["weight_kg"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("weight", [-5, 501, "много"])
async def test_weight_rejects_bad_values(client, auth_headers, weight):
    response = await client.post("/workouts/", json={**WORKOUT, "weight_kg": weight}, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_weight_to_null_means_bodyweight(client, auth_headers):
    created = await client.post("/workouts/", json={**WORKOUT, "weight_kg": 40}, headers=auth_headers)
    workout_id = created.json()["id"]

    response = await client.patch(f"/workouts/{workout_id}", json={"weight_kg": None}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["weight_kg"] is None
    # остальные поля null по-прежнему нельзя
    assert (await client.patch(f"/workouts/{workout_id}", json={"sets": None}, headers=auth_headers)).status_code == 422


@pytest.mark.asyncio
async def test_progress_groups_by_exercise(client, auth_headers):
    for weight in (60, 70, 65):
        await client.post("/workouts/", json={**WORKOUT, "workout_name": "Жим лёжа", "weight_kg": weight}, headers=auth_headers)
    # то же упражнение с другим регистром и пробелом — должно попасть в ту же группу
    await client.post("/workouts/", json={**WORKOUT, "workout_name": "жим лёжа ", "weight_kg": 72.5}, headers=auth_headers)
    await client.post("/workouts/", json={**WORKOUT, "workout_name": "Подтягивания"}, headers=auth_headers)

    response = await client.get("/workouts/progress", headers=auth_headers)
    assert response.status_code == 200
    progress = response.json()
    assert len(progress) == 1  # подтягивания без веса в прогресс не попадают
    bench = progress[0]
    assert bench["records"] == 4
    assert bench["best_weight"] == 72.5
    assert bench["first_weight"] == 60
    assert bench["last_weight"] == 72.5


@pytest.mark.asyncio
async def test_progress_treats_yo_and_ye_as_same_letter(client, auth_headers):
    await client.post("/workouts/", json={**WORKOUT, "workout_name": "Жим лёжа", "weight_kg": 60}, headers=auth_headers)
    await client.post("/workouts/", json={**WORKOUT, "workout_name": "жим лежа", "weight_kg": 65}, headers=auth_headers)

    progress = (await client.get("/workouts/progress", headers=auth_headers)).json()
    assert len(progress) == 1
    assert progress[0]["records"] == 2
    assert progress[0]["last_weight"] == 65


@pytest.mark.asyncio
async def test_high_reps_advice_on_bulking(client, auth_headers):
    await client.patch("/auth/me", json=PROFILE, headers=auth_headers)  # цель: набор массы
    await client.post("/workouts/", json={**WORKOUT, "workout_name": "Сгибания", "reps": 20, "weight_kg": 8}, headers=auth_headers)

    advice = (await client.get("/recommendations/", headers=auth_headers)).json()
    workout_advice = [a["text"] for a in advice if a["category"] == "workout"]
    assert len(workout_advice) == 1
    assert "«Сгибания»" in workout_advice[0]
    assert "9–13" in workout_advice[0]


@pytest.mark.asyncio
@pytest.mark.parametrize("goal, reps", [("bulking", 13), ("cutting", 20)])
async def test_no_high_reps_advice(client, auth_headers, goal, reps):
    # 13 повторений — ещё норма; на похудении совет не нужен
    await client.patch("/auth/me", json={**PROFILE, "current_goal": goal}, headers=auth_headers)
    await client.post("/workouts/", json={**WORKOUT, "reps": reps}, headers=auth_headers)

    advice = (await client.get("/recommendations/", headers=auth_headers)).json()
    assert not [a for a in advice if a["category"] == "workout"]
