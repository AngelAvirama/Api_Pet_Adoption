const { trace } = require('@opentelemetry/api');
const { randomUUID } = require('crypto');

const MAX_TRACE_ID_LENGTH = 128;
const VALID_TRACE_ID = /^[A-Za-z0-9._:-]+$/;

// The X-Trace-Id sent by the caller (the coordinator) wins: it is the id that
// correlates the three clouds. The OpenTelemetry trace id is only a fallback
// for direct calls, and a random UUID the last resort.
const resolveTraceId = (incomingTraceId, otelTraceId) => {
  if (
    typeof incomingTraceId === 'string' &&
    incomingTraceId.length > 0 &&
    incomingTraceId.length <= MAX_TRACE_ID_LENGTH &&
    VALID_TRACE_ID.test(incomingTraceId)
  ) {
    return incomingTraceId;
  }

  return otelTraceId || randomUUID();
};

const traceIdMiddleware = (req, res, next) => {
  const activeSpan = trace.getActiveSpan();
  const otelTraceId = activeSpan?.spanContext().traceId;

  const traceId = resolveTraceId(req.get('X-Trace-Id'), otelTraceId);

  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);

  if (activeSpan) {
    activeSpan.setAttribute('app.trace_id', traceId);
  }

  next();
};

module.exports = traceIdMiddleware;
module.exports.resolveTraceId = resolveTraceId;
