import json
import logging

import redis.asyncio as redis
from redis.asyncio.retry import Retry
from redis.backoff import NoBackoff
from redis.exceptions import RedisError

from src.config import settings

logger = logging.getLogger(__name__)

redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True,
    socket_connect_timeout=1,
    socket_timeout=1,
    retry=Retry(NoBackoff(), 0),
)

STATS_CACHE_TTL = 60


def stats_cache_key(user_id: int) -> str:
    return f"stats_summary:{user_id}"


async def cache_get(key: str):
    try:
        cached = await redis_client.get(key)
    except RedisError as error:
        logger.warning("Redis недоступен, читаю из БД: %s", error)
        return None
    return json.loads(cached) if cached else None


async def cache_set(key: str, value, ttl: int = STATS_CACHE_TTL) -> None:
    try:
        await redis_client.set(key, json.dumps(value), ex=ttl)
    except RedisError as error:
        logger.warning("Redis недоступен, кэш не сохранён: %s", error)


async def invalidate_user_stats(user_id: int) -> None:
    try:
        await redis_client.delete(stats_cache_key(user_id))
    except RedisError as error:
        logger.warning("Redis недоступен, кэш не сброшен: %s", error)
