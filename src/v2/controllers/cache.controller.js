const { getCacheMetrics } = require('../services/external.service');

const getCacheMetricsController = (req, res) => {
  res.status(200).json({
    data: getCacheMetrics(),
    traceId: req.traceId
  });
};

module.exports = {
  getCacheMetricsController
};