const client = require('prom-client');
const { getCacheMetrics } = require('../v2/services/external.service');

const register = new client.Registry();

client.collectDefaultMetrics({
  register
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP error responses',
  labelNames: ['method', 'route', 'status_code'],
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
  cacheMissesTotal
};