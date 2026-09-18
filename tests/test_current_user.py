import pytest

@pytest.mark.asyncio
async def test_cannot_access_other_users_workout(client):
    await client.post(
        "/auth/register",
        json={"username": "test_user_A", "email": "test_A@example.com", "password": "testpassword123"},
    )
    login_response_A = await client.post(
        "/auth/login",
        data={"username": "test_user_A", "password": "testpassword123"},
    )
    token_user_A = login_response_A.json()["access_token"]

    create_response = await client.post(
        "/workouts/",
        json={
            "workout_name": "жим лежа",
            "reps": 8,
            "sets": 3,
            "to_failure": True,
            "workout_time": 40,
            "time_between_sets": 90,
        },
        headers={"Authorization": f"Bearer {token_user_A}"},
    )
    workout_id = create_response.json()["id"]

    await client.post(
        "/auth/register",
        json={"username": "test_user_B", "email": "test_B@example.com", "password": "testpassword123"},
    )
    login_response_B = await client.post(
        "/auth/login",
        data={"username": "test_user_B", "password": "testpassword123"},
    )
    token_user_B = login_response_B.json()["access_token"]

    response = await client.get(
        f"/workouts/{workout_id}",
        headers={"Authorization": f"Bearer {token_user_B}"},
    )

    assert response.status_code == 404