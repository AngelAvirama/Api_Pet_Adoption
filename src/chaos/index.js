const { createStoreFromEnv, createFaultCache } = require('./store');
const logger = require('../config/logger');
const { publishFaultState } = require('./telemetry');

// Single chaos switch for the process: the store (memory or SSM) and the
// per-task cache that the request path reads.
const store = createStoreFromEnv();

const listeners = [publishFaultState];

const cache = createFaultCache({
  store,
  ttlMs: Number(process.env.CHAOS_CACHE_MS || 3000),
  log: (evento, datos) => logger.warn('Chaos switch store error', { evento, ...datos }),
  onChange: (fault) => listeners.forEach((listener) => listener(fault))
});

const onFaultChange = (listener) => {
  listeners.push(listener);
};

module.exports = {
  store,
  cache,
  onFaultChange
};
