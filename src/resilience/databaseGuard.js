const CircuitBreaker = require('opossum');
const logger = require('../config/logger');

const BREAKER_STATE = { closed: 0, halfOpen: 1, open: 2 };

// Classifies why a guarded call failed, for the response and the metrics
const failureReason = (error) => {
  if (error?.code === 'EOPENBREAKER') {
    return 'circuito_abierto';
  }
  if (error?.code === 'ETIMEDOUT') {
    return 'timeout';
  }
  return 'error_base_de_datos';
};

// Pattern 1: timeout per call + circuit breaker on the database dependency.
// - The timeout keeps a slow or unreachable database from holding requests
//   (and Prisma connections) for seconds: the call fails after timeoutMs.
// - When half of the calls in the rolling window fail, the circuit opens and
//   the next calls fail at once, without touching the database, until
//   resetTimeout passes and a single trial call is let through (half open).
const createDatabaseGuard = ({ name, action, config, onStateChange } = {}) => {
  const breaker = new CircuitBreaker(action, {
    name,
    timeout: config.timeoutMs,
    errorThresholdPercentage: config.breaker.errorThresholdPercentage,
    volumeThreshold: config.breaker.volumeThreshold,
    resetTimeout: config.breaker.resetTimeout,
    rollingCountTimeout: config.breaker.rollingCountTimeout
  });

  const notify = (state) => {
    logger.warn('Circuit breaker state changed', {
      evento: 'circuito_cambio',
      circuito: name,
      estado: state
    });
    if (onStateChange) {
      onStateChange(name, BREAKER_STATE[state]);
    }
  };

  breaker.on('open', () => notify('open'));
  breaker.on('halfOpen', () => notify('halfOpen'));
  breaker.on('close', () => notify('closed'));

  return {
    breaker,
    fire: (...args) => breaker.fire(...args),
    shutdown: () => breaker.shutdown(),
    state: () => {
      if (breaker.opened) {
        return 'open';
      }
      return breaker.halfOpen ? 'halfOpen' : 'closed';
    }
  };
};

module.exports = {
  BREAKER_STATE,
  failureReason,
  createDatabaseGuard
};
