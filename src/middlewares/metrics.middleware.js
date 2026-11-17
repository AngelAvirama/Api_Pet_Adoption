const {
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal
} = require('../config/metrics');

const { recordHttpRequest } = require('../config/otelMetrics');
const logger = require('../config/logger');
const { getRound } = require('../resilience/config');

// Route template for the metrics (e.g. /api/v2/animals/random,
// /api/v4/animals/:id). It is rebuilt from originalUrl because, when a
// request ends in the error handler, Express has already left the router and
// req.baseUrl no longer has the /api/vN prefix: using it labelled every 5xx
// of the contract as /animals/random and hid them from the dashboard.
const routeLabel = (req) => {
  const path = (req.originalUrl || req.url || '').split('?')[0];

  if (!req.route?.path || typeof req.route.path !== 'string') {
    return path;
  }

  const segments = path.split('/').filter(Boolean);
  const routeSegments = req.route.path.split('/').filter(Boolean);
  const prefix = segments.slice(0, Math.max(0, segments.length - routeSegments.length));

  return `/${[...prefix, ...routeSegments].join('/')}`;
};

const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;

    const route = routeLabel(req);

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
      viaAlb: req.viaAlb,
      durationMs: Number((duration * 1000).toFixed(2))
    });
  });

  next();
};

module.exports = metricsMiddleware;
module.exports.routeLabel = routeLabel;