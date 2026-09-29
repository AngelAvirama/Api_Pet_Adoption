const { createClient } = require('redis');

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379)
  }
});

redisClient.on('error', (error) => {
  console.error('Redis error:', error);
});

const connectRedis = async () => {
  if (process.env.REDIS_ENABLED === 'false') {
    return false;
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return true;
};

module.exports = {
  redisClient,
  connectRedis
};