const { trace } = require('@opentelemetry/api');

const getTraceId = () => {
  const activeSpan = trace.getActiveSpan();

  return activeSpan?.spanContext().traceId || 'unknown';
};

const log = (level, message, metadata = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: process.env.OTEL_SERVICE_NAME || 'api-b-adopcion',
    traceId: getTraceId(),
    message,
    ...metadata
  }));
};

const info = (message, metadata = {}) => {
  log('info', message, metadata);
};

const error = (message, metadata = {}) => {
  log('error', message, metadata);
};

module.exports = {
  info,
  error,
  getTraceId
};