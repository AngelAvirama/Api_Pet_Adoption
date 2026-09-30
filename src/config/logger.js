const { trace } = require('@opentelemetry/api');
const { logs, SeverityNumber } = require('@opentelemetry/api-logs');

const getTraceId = () => {
  const activeSpan = trace.getActiveSpan();

  return activeSpan?.spanContext().traceId || 'unknown';
};

const otelLogger = logs.getLogger('api-b-adopcion');

const log = (level, message, metadata = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.OTEL_SERVICE_NAME || 'api-b-adopcion',
    traceId: getTraceId(),
    message,
    ...metadata
  };

  // Mantener los logs visibles en kubectl logs
  console.log(JSON.stringify(entry));

  // Enviar el mismo log a OpenTelemetry → Grafana Cloud → Loki
  otelLogger.emit({
    severityNumber:
      level === 'error'
        ? SeverityNumber.ERROR
        : SeverityNumber.INFO,
    severityText: level.toUpperCase(),
    body: JSON.stringify(entry),
    attributes: {
      'service.name': entry.service,
      'trace.id': entry.traceId,
      'log.level': level
    }
  });
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