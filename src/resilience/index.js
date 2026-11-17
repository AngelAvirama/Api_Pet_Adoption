const animalService = require('../services/animal.service');
const { circuitBreakerState } = require('../config/metrics');
const { resilienceConfig } = require('./config');
const { createResilientAnimalService } = require('./animalService');
const { countDegradedResponse } = require('../chaos/telemetry');
const { setCircuitBreakerState } = require('../config/otelMetrics');

// One resilient service per process, configured once from the environment
const resilientAnimalService = createResilientAnimalService({
  service: animalService,
  config: resilienceConfig(),
  onBreakerState: (circuito, value) => {
    circuitBreakerState.set({ circuito }, value);
    setCircuitBreakerState(circuito, value);
  },
  onDegraded: (motivo) => countDegradedResponse('/animals/random', motivo)
});

module.exports = {
  resilientAnimalService
};
