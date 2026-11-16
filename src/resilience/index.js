const animalService = require('../services/animal.service');
const { circuitBreakerState } = require('../config/metrics');
const { resilienceConfig } = require('./config');
const { createResilientAnimalService } = require('./animalService');

// One resilient service per process, configured once from the environment
const resilientAnimalService = createResilientAnimalService({
  service: animalService,
  config: resilienceConfig(),
  onBreakerState: (circuito, value) => circuitBreakerState.set({ circuito }, value)
});

module.exports = {
  resilientAnimalService
};
