import pytest

@pytest.mark.asyncio
async def test_create_workout(client):
    await client.post(
        "/auth/register",
        json={
            "username": "test_user",
            "email": "test@example.com",
            "password": "testpassword123",
        },
    )
    login_response = await client.post(
        "/auth/login",
        data={
            "username": "test_user",
            "password": "testpassword123",
        }
    )
    token = login_response.json()["access_token"]
    
    response = await client.post(
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
    
    assert response.status_code == 201
    data = response.json()
    assert data["workout_name"] == "жим лежа"
    assert data["user_id"] is not None