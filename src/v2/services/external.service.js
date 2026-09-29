const { redisClient, connectRedis } = require('../../config/redis');

const CACHE_TTL = 60;

const getExternalData = async (url, cacheKey) => {
  await connectRedis();

  const cachedData = await redisClient.get(cacheKey);

  if (cachedData) {
    console.log(`Redis cache hit: ${cacheKey}`);
    return JSON.parse(cachedData);
  }

  console.log(`Redis cache miss: ${cacheKey}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`External API error: ${response.status}`);
  }

  const data = await response.json();

  await redisClient.setEx(
    cacheKey,
    CACHE_TTL,
    JSON.stringify(data)
  );

  return data;
};

const getRandomVuelo = () => {
  const url = `${process.env.JUAN_API_URL}/api/v2/entidades/vuelos/random`;

  return getExternalData(
    url,
    'juan:vuelo:random'
  );
};

const getRandomImagen = () => {
  const url = `${process.env.LEONARDO_API_URL}/api/v2/imagenes/random`;

  return getExternalData(
    url,
    'leonardo:imagen:random'
  );
};

module.exports = {
  getRandomVuelo,
  getRandomImagen
};