const {
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal
} = require('../config/metrics');
const { recordHttpRequest } = require('../config/otel-metrics');

// Al terminar la respuesta Express ya limpió req.baseUrl, así que el prefijo
// (/api/v2, /api/animals...) se reconstruye desde la URL original.
const fullRoute = (req) => {
  const routePath = req.route.path;
  const routeSegments = routePath.split('/').filter(Boolean).length;
  const urlSegments = req.originalUrl.split('?')[0].split('/').filter(Boolean);
  const prefix = urlSegments.slice(0, Math.max(0, urlSegments.length - routeSegments));
  const base = prefix.length ? `/${prefix.join('/')}` : '';
  return routePath === '/' && base ? base : `${base}${routePath}`;
};

const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;

    const route = req.route?.path ? fullRoute(req) : req.path;

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
    recordHttpRequest(req.method, req.route?.path ? route : 'sin_ruta', res.statusCode, duration * 1000);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
  });

  next();
};

module.exports = metricsMiddleware;
