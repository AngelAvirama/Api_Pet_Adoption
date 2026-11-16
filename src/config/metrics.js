const client = require('prom-client');
const { getCacheMetrics } = require('../v3/services/external.service');

const register = new client.Registry();

client.collectDefaultMetrics({
  register
});

// Etiquetas comunes para distinguir Stable y Canary
const httpLabels = [
  'method',
  'route',
  'status_code',
  'app_version',
  'app_track',
  'round'
];

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: httpLabels,
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: httpLabels,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP error responses',
  labelNames: httpLabels,
  registers: [register]
});

const animalRecommendationRequestsTotal = new client.Counter({
  name: 'animal_recommendation_requests_total',
  help: 'Total number of successful animal recommendation requests',
  labelNames: ['app_version', 'app_track'],
  registers: [register]
});

const animalsRecommendedTotal = new client.Counter({
  name: 'animals_recommended_total',
  help: 'Total number of animals returned by recommendation requests',
  labelNames: ['app_version', 'app_track'],
  registers: [register]
});

const cacheHitsTotal = new client.Gauge({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register],

  async collect() {
    const { hits } = await getCacheMetrics();
    this.set(hits);
  }
});

const cacheMissesTotal = new client.Gauge({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register],

  async collect() {
    const { misses } = await getCacheMetrics();
    this.set(misses);
  }
});

// Release 5: chaos engineering. chaos_fault_active marks the injection
// window on the dashboard; the other two show what the fault and the
// resilience patterns did during it.
const chaosFaultActive = new client.Gauge({
  name: 'chaos_fault_active',
  help: '1 while the chaos switch has an active fault on the dependency',
  labelNames: ['dependencia', 'tipo'],
  registers: [register]
});

const chaosInjectedFailuresTotal = new client.Counter({
  name: 'chaos_injected_failures_total',
  help: 'Failures injected by the chaos switch',
  labelNames: ['dependencia', 'operacion'],
  registers: [register]
});

const degradedResponsesTotal = new client.Counter({
  name: 'degraded_responses_total',
  help: 'Responses served in degraded mode instead of failing',
  labelNames: ['ruta', 'motivo'],
  registers: [register]
});

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state: 0 closed, 1 half open, 2 open',
  labelNames: ['circuito'],
  registers: [register]
});

module.exports = {
  register,
  circuitBreakerState,
  chaosFaultActive,
  chaosInjectedFailuresTotal,
  degradedResponsesTotal,
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal,
  cacheHitsTotal,
  cacheMissesTotal,
  animalRecommendationRequestsTotal,
  animalsRecommendedTotal
};