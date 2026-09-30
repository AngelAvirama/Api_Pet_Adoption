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

const recordHttpRequest = ({
  method,
  route,
  statusCode,
  durationMs
}) => {
  const attributes = {
    'http.method': method,
    'http.route': route,
    'http.status_code': statusCode
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
  recordCacheHit,
  recordCacheMiss
};