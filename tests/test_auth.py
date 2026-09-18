import pytest


@pytest.mark.asyncio
async def test_register_user(client):
    response = await client.post(
        "/auth/register",
        json={
            "username": "test_user",
            "email": "test@example.com",
            "password": "testpassword123",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "test_user"
    assert data["email"] == "test@example.com"
    assert "hashed_password" not in data

@pytest.mark.asyncio
async def test_existing_user(client):
    await client.post(
        "auth/register",
        json={
            "username": "test_user",
            "email": "test@example.com",
            "password": "testpassword123",
        },
    )
    response = await client.post(
        "/auth/register",
        json={
            "username": "test_user",
            "email": "test@example.com",
            "password": "testpassword123",
        }
    )
    
    assert response.status_code == 400