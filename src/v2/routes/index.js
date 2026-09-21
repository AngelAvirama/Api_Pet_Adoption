const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: 'v2',
    traceId: req.traceId
  });
});

module.exports = router;