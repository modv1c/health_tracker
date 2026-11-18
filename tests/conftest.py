import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from src.main import app
from src.database import Base, get_db
from src.config import settings
from src.redis_client import redis_client

TEST_DATABASE_URL = (
    f"postgresql+asyncpg://{settings.DB_USER}:{settings.DB_PASS}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/health_tracker_test"
)

test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def clear_stats_cache():
    # id пользователей в каждом тесте начинаются заново, поэтому чистим кэш,
    # чтобы статистика одного теста не "протекла" в другой
    try:
        async for key in redis_client.scan_iter("stats_summary:*"):
            await redis_client.delete(key)
    except Exception:
        pass


@pytest_asyncio.fixture
async def client(db_session):
    await clear_stats_cache()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def auth_headers(client):
    """Регистрирует пользователя и возвращает заголовок с его токеном."""
    await client.post(
        "/auth/register",
        json={"username": "main_user", "email": "main@example.com", "password": "testpassword123"},
    )
    response = await client.post(
        "/auth/login", data={"username": "main_user", "password": "testpassword123"}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
