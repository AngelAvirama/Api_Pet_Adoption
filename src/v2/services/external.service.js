const { redisClient, connectRedis } = require('../../config/redis');
const {
  recordCacheHit,
  recordCacheMiss
} = require('../../config/otelMetrics');

const CACHE_TTL = 60;

const isRedisEnabled = () => process.env.REDIS_ENABLED !== 'false';

const getExternalData = async (url, cacheKey, cacheName) => {
  if (isRedisEnabled()) {
    try {
      await connectRedis();

      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        await redisClient.incr('metrics:cache:hits');

        recordCacheHit(cacheName);

        console.log(`Redis cache hit: ${cacheKey}`);

        return JSON.parse(cachedData);
      }

      await redisClient.incr('metrics:cache:misses');

      recordCacheMiss(cacheName);

      console.log(`Redis cache miss: ${cacheKey}`);
    } catch (error) {
      console.error('Redis unavailable:', error.message);
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`External API error: ${response.status}`);
  }

  const data = await response.json();

  if (isRedisEnabled()) {
    try {
      await redisClient.setEx(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Redis cache write error:', error.message);
    }
  }

  return data;
};

const getRandomVuelo = () => {
  const url = `${process.env.JUAN_API_URL}/api/v2/entidades/vuelos/random`;

  return getExternalData(
    url,
    'juan:vuelo:random',
    'juan_vuelo'
  );
};

const getRandomImagen = () => {
  const url = `${process.env.LEONARDO_API_URL}/api/v2/imagenes/random`;

  return getExternalData(
    url,
    'leonardo:imagen:random',
    'leonardo_imagen'
  );
};

const getCacheMetrics = async () => {
  if (!isRedisEnabled()) {
    return {
      hits: 0,
      misses: 0
    };
  }

  try {
    await connectRedis();

    const [hits, misses] = await Promise.all([
      redisClient.get('metrics:cache:hits'),
      redisClient.get('metrics:cache:misses')
    ]);

    return {
      hits: Number(hits || 0),
      misses: Number(misses || 0)
    };
  } catch (error) {
    console.error('Redis metrics error:', error.message);

    return {
      hits: 0,
      misses: 0
    };
  }
};

module.exports = {
  getRandomVuelo,
  getRandomImagen,
  getCacheMetrics
};