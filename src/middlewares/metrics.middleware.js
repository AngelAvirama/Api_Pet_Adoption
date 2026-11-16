const {
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal
} = require('../config/metrics');

const { recordHttpRequest } = require('../config/otelMetrics');
const logger = require('../config/logger');
const { getRound } = require('../resilience/config');

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
      status_code: String(res.statusCode),
      app_version: req.appVersion || process.env.APP_VERSION || 'unknown',
      app_track: req.appTrack || process.env.APP_TRACK || 'unknown',
      round: getRound()
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
      durationMs: duration * 1000,
      appVersion: labels.app_version,
      appTrack: labels.app_track,
      round: labels.round
    });

    logger.info('HTTP request completed', {
      traceId: req.traceId,
      method: req.method,
      route,
      statusCode: res.statusCode,
      appVersion: labels.app_version,
      appTrack: labels.app_track,
      round: labels.round,
      durationMs: Number((duration * 1000).toFixed(2))
    });
  });

  next();
};

module.exports = metricsMiddleware;