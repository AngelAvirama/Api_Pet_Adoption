const express = require('express');
const animalController = require('../controllers/animal.controller');

// Contract consumed by the coordinator of the group. It is mounted on
// /api/v2 (the path the coordinator already calls) and on /api/v5.
const createContractRouter = (version) => {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      version,
      traceId: req.traceId
    });
  });

  router.get('/animals/random', animalController.getRandomAnimal);

  return router;
};

module.exports = createContractRouter;
