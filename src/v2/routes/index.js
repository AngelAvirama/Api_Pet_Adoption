const express = require('express');
const animalRoutes = require('./animal.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: 'v2',
    traceId: req.traceId
  });
});

router.use(animalRoutes);

module.exports = router;