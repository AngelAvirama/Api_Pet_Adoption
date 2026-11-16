const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;

  logger.error('Request failed', {
    method: req.method,
    route: req.originalUrl,
    statusCode: status,
    error: err.message
  });

  res.status(status).json({
    error: err.message || 'Internal server error',
    traceId: req.traceId
  });
};

module.exports = errorHandler;
