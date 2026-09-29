const express = require('express');
const animalRoutes = require('./animal.routes');
const adoptanteRoutes = require('./adoptante.routes');
const adopcionRoutes = require('./adopcion.routes');
const cacheController = require('../controllers/cache.controller');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: 'v2',
    traceId: req.traceId
  });
});

router.get('/cache/metrics', cacheController.getCacheMetricsController);

router.use(animalRoutes);
router.use(adoptanteRoutes);
router.use(adopcionRoutes);

module.exports = router;