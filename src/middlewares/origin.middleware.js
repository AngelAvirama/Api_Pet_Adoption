const logger = require('../config/logger');

// Network origin of each request (defense in depth, experiment 2 of the
// security game day). Inside AWS the only declared path to the tasks is the
// ALB, which always adds X-Forwarded-For. A request without it that is not the
// ALB health checker reached the task directly: a security group opened to
// the Internet, or an east-west hop that was never declared. The event is
// logged with the trace id so it can be correlated with the flow.
const ALB_HEALTH_CHECKER = /^ELB-HealthChecker\//;

const classifyOrigin = (req) => {
  const forwardedFor = req.get('x-forwarded-for');
  const userAgent = req.get('user-agent') || '';

  if (forwardedFor) {
    return { viaAlb: true, motivo: 'alb' };
  }
  if (ALB_HEALTH_CHECKER.test(userAgent)) {
    return { viaAlb: true, motivo: 'health_check_alb' };
  }
  return { viaAlb: false, motivo: 'directo' };
};

const originMiddleware = (req, res, next) => {
  const origin = classifyOrigin(req);
  req.viaAlb = origin.viaAlb;

  if (!origin.viaAlb && process.env.ORIGIN_CHECK_ENABLED === 'true') {
    logger.warn('Request reached the task without the load balancer', {
      evento: 'acceso_directo_sin_alb',
      method: req.method,
      route: (req.originalUrl || '').split('?')[0],
      ip: req.socket?.remoteAddress || null,
      agente: req.get('user-agent') || null
    });
  }

  next();
};

module.exports = originMiddleware;
module.exports.classifyOrigin = classifyOrigin;
