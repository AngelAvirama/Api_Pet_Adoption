const { metrics } = require('@opentelemetry/api');

const meter = metrics.getMeter('api-pet-adoption');

const httpRequests = meter.createCounter('http.server.requests', {
  description: 'Total number of HTTP requests'
});

const httpDuration = meter.createHistogram('http.server.duration', {
  description: 'HTTP request duration',
  unit: 'ms'
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

module.exports = {
  recordHttpRequest
};