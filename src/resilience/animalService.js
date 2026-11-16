const { createDatabaseGuard, failureReason } = require('./databaseGuard');

class DependencyUnavailableError extends Error {
  constructor(motivo, cause) {
    super('La base de datos no esta disponible');
    this.name = 'DependencyUnavailableError';
    this.status = 503;
    this.motivo = motivo;
    this.retryAfterSeconds = 5;
    this.cause = cause;
  }
}

// Read path of the animal the coordinator consumes.
// Round 0 (enabled=false): calls the database directly, as before.
// Round 1 (enabled=true): every call goes through the database guard, so a
// failing database answers in at most timeoutMs and, with the circuit open,
// immediately with a 503 + Retry-After instead of hanging.
const createResilientAnimalService = ({ service, config, onBreakerState } = {}) => {
  const guard = config.enabled
    ? createDatabaseGuard({
      name: 'database_animals',
      action: () => service.getRandom(),
      config,
      onStateChange: onBreakerState
    })
    : null;

  const getRandom = async () => {
    if (!guard) {
      return { animal: await service.getRandom(), degradado: false };
    }

    try {
      return { animal: await guard.fire(), degradado: false };
    } catch (error) {
      throw new DependencyUnavailableError(failureReason(error), error);
    }
  };

  return {
    getRandom,
    breakerState: () => (guard ? guard.state() : 'disabled'),
    shutdown: () => guard && guard.shutdown()
  };
};

module.exports = {
  DependencyUnavailableError,
  createResilientAnimalService
};
