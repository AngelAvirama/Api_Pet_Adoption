// Round 0 runs without protections, round 1 with them. RESILIENCE_ENABLED is
// the only difference between the two rounds: same image, same load, same
// fault. Every threshold can be tuned by environment without a rebuild.
const isResilienceEnabled = (env = process.env) => env.RESILIENCE_ENABLED === 'true';

const getRound = (env = process.env) => (isResilienceEnabled(env) ? '1' : '0');

const readPositiveInt = (env, name, fallback) => {
  const value = Number(env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const resilienceConfig = (env = process.env) => ({
  enabled: isResilienceEnabled(env),
  timeoutMs: readPositiveInt(env, 'DB_TIMEOUT_MS', 1000),
  breaker: {
    errorThresholdPercentage: readPositiveInt(env, 'BREAKER_ERROR_PERCENTAGE', 50),
    volumeThreshold: readPositiveInt(env, 'BREAKER_VOLUME_THRESHOLD', 5),
    resetTimeout: readPositiveInt(env, 'BREAKER_RESET_MS', 10000),
    rollingCountTimeout: readPositiveInt(env, 'BREAKER_ROLLING_WINDOW_MS', 10000)
  },
  fallbackSize: readPositiveInt(env, 'FALLBACK_CACHE_SIZE', 50)
});

// X-Ronda on every response: the chaos gate checks it before measuring, so a
// round is never measured against the wrong deployment.
const roundMiddleware = (req, res, next) => {
  res.setHeader('X-Ronda', getRound());
  next();
};

module.exports = {
  isResilienceEnabled,
  getRound,
  resilienceConfig,
  roundMiddleware
};
