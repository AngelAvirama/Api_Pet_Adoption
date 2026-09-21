const crypto = require('crypto');

function traceIdMiddleware(req, res, next) {
  const traceId = req.header('X-Trace-Id') || crypto.randomUUID();

  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);

  next();
}

module.exports = traceIdMiddleware;