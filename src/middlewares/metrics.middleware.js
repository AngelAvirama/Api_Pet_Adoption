const {
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal
} = require('../config/metrics');

const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;

    const route = req.route?.path
      ? req.originalUrl.startsWith('/api/v2')
        ? `/api/v2${req.baseUrl}${req.route.path}`
        : `${req.baseUrl}${req.route.path}`
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
  });

  next();
};

module.exports = metricsMiddleware;