const { metrics } = require('@opentelemetry/api');

const meter = metrics.getMeter('api-pet-adoption');

const httpRequests = meter.createCounter('http.server.requests', {
  description: 'Total number of HTTP requests'
});

const httpDuration = meter.createHistogram('http.server.duration', {
  description: 'HTTP request duration',
  unit: 'ms'
});

const cacheHits = meter.createCounter('cache.hits', {
  description: 'Total number of cache hits'
});

const cacheMisses = meter.createCounter('cache.misses', {
  description: 'Total number of cache misses'
});

const chaosInjectedFailures = meter.createCounter('chaos.injected_failures', {
  description: 'Failures injected by the chaos switch'
});

const degradedResponses = meter.createCounter('responses.degraded', {
  description: 'Responses served in degraded mode instead of failing'
});

const chaosFaultState = { latencia: 0, error: 0 };

const chaosFaultActive = meter.createObservableGauge('chaos.fault.active', {
  description: '1 while the chaos switch has an active fault on the database'
});

chaosFaultActive.addCallback((result) => {
  Object.entries(chaosFaultState).forEach(([tipo, value]) => {
    result.observe(value, { dependencia: 'database', tipo });
  });
});

const breakerStates = {};

const circuitBreakerState = meter.createObservableGauge('circuit_breaker.state', {
  description: 'Circuit breaker state: 0 closed, 1 half open, 2 open'
});

circuitBreakerState.addCallback((result) => {
  Object.entries(breakerStates).forEach(([circuito, value]) => {
    result.observe(value, { circuito });
  });
});

const setCircuitBreakerState = (circuito, value) => {
  breakerStates[circuito] = value;
};

const setChaosFaultState = (fault) => {
  chaosFaultState.latencia = fault && fault.latency_ms > 0 ? 1 : 0;
  chaosFaultState.error = fault && fault.error_rate > 0 ? 1 : 0;
};

const recordChaosInjectedFailure = (operacion) => {
  chaosInjectedFailures.add(1, { dependencia: 'database', operacion });
};

const recordDegradedResponse = (ruta, motivo) => {
  degradedResponses.add(1, { ruta, motivo });
};

const recordHttpRequest = ({
  method,
  route,
  statusCode,
  durationMs,
  appVersion,
  appTrack,
  round
}) => {
  const attributes = {
    'http.method': method,
    'http.route': route,
    'http.status_code': statusCode,
    'app.version': appVersion || 'unknown',
    'app.track': appTrack || 'unknown',
    'app.round': round || 'unknown'
  };

  httpRequests.add(1, attributes);
  httpDuration.record(durationMs, attributes);
};

const recordCacheHit = (cacheName) => {
  cacheHits.add(1, {
    'cache.name': cacheName
  });
};

const recordCacheMiss = (cacheName) => {
  cacheMisses.add(1, {
    'cache.name': cacheName
  });
};

module.exports = {
  recordHttpRequest,
  setChaosFaultState,
  setCircuitBreakerState,
  recordChaosInjectedFailure,
  recordDegradedResponse,
  recordCacheHit,
  recordCacheMiss
};