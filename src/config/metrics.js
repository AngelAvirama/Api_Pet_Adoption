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
  'app_track'
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

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal,
  cacheHitsTotal,
  cacheMissesTotal,
  animalRecommendationRequestsTotal,
  animalsRecommendedTotal
};