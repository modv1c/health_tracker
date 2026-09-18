import pytest

@pytest.mark.asyncio
async def test_partial_patch(client):
    await client.post(
        "/auth/register",
        json={
            "username": "test_user",
            "email": "test@example.com",
            "password": "testpassword123",
        },
    )
    response_login = await client.post(
        "/auth/login",
        data={
            "username": "test_user",
            "password": "testpassword123",
        }
    )
    token = response_login.json()["access_token"]
    
    workout = await client.post(
        "/workouts/",
        json={
            "workout_name": "жим лежа",
            "reps": 8,
            "sets": 3,
            "to_failure": True,
            "workout_time": 40,
            "time_between_sets": 90,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    workout_id = workout.json()["id"]
    
    patch_workout = await client.patch(
        f"/workouts/{workout_id}",
        json={
            "workout_name": "присяд",
            "to_failure": False,
            "reps": 10
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    
    assert patch_workout.status_code == 200
    data = patch_workout.json()
    assert data["sets"] == 3
    assert data["workout_time"] == 40
    assert data["workout_name"] == "присяд"
    assert data["to_failure"] == False
    