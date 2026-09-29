const { trace } = require('@opentelemetry/api');
const { randomUUID } = require('crypto');

const traceIdMiddleware = (req, res, next) => {
  const activeSpan = trace.getActiveSpan();

  const otelTraceId = activeSpan?.spanContext().traceId;
  const incomingTraceId = req.get('X-Trace-Id');

  const traceId = otelTraceId || incomingTraceId || randomUUID();

  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);

  next();
};

module.exports = traceIdMiddleware;