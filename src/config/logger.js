const { trace } = require('@opentelemetry/api');
const { logs, SeverityNumber } = require('@opentelemetry/api-logs');
const { getContext } = require('./requestContext');

// The X-Trace-Id of the request (the coordinator's id) comes first, so the
// logs of the three clouds can be joined by the same value.
const getTraceId = () => {
  const { traceId } = getContext();

  if (traceId) {
    return traceId;
  }

  const activeSpan = trace.getActiveSpan();

  return activeSpan?.spanContext().traceId || 'unknown';
};

const getOtelTraceId = () => {
  const activeSpan = trace.getActiveSpan();

  return activeSpan?.spanContext().traceId;
};

const SEVERITY = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR
};

const otelLogger = logs.getLogger('api-b-adopcion');

const log = (level, message, metadata = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.OTEL_SERVICE_NAME || 'api-b-adopcion',
    traceId: getTraceId(),
    otelTraceId: getOtelTraceId(),
    message,
    ...metadata
  };

  // Mantener los logs visibles en kubectl logs
  console.log(JSON.stringify(entry));

  // Enviar el mismo log a OpenTelemetry → Grafana Cloud → Loki
  otelLogger.emit({
    severityNumber: SEVERITY[level] || SeverityNumber.INFO,
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

const warn = (message, metadata = {}) => {
  log('warn', message, metadata);
};

const error = (message, metadata = {}) => {
  log('error', message, metadata);
};

module.exports = {
  info,
  warn,
  error,
  getTraceId
};