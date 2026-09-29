const {
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal
} = require('../config/metrics');

const { recordHttpRequest } = require('../config/otelMetrics');
const logger = require('../config/logger');

const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;

    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.path;

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }

    recordHttpRequest({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs: duration * 1000
    });

    logger.info('HTTP request completed', {
      traceId: req.traceId,
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs: Number((duration * 1000).toFixed(2))
    });
  });

  next();
};

module.exports = metricsMiddleware;