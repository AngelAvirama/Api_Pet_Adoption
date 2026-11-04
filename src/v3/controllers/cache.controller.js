const { getCacheMetrics } = require('../services/external.service');

const getCacheMetricsController = async (req, res) => {
  res.status(200).json({
    data: await getCacheMetrics(),
    traceId: req.traceId
  });
};

module.exports = {
  getCacheMetricsController
}