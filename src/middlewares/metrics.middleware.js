const {
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal
} = require('../config/metrics');

const { recordHttpRequest } = require('../config/otelMetrics');

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
  });

  next();
};

module.exports = metricsMiddleware;