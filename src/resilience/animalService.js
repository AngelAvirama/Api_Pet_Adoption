const { createDatabaseGuard, failureReason } = require('./databaseGuard');
const { createFallbackCache } = require('./fallbackCache');

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
// immediately. Pattern 2, graceful degradation: instead of failing, the
// service answers with a last known animal marked degradado=true. Only when
// it has never seen an animal does it answer 503 + Retry-After.
const createResilientAnimalService = ({ service, config, onBreakerState, onDegraded } = {}) => {
  const fallback = createFallbackCache({ maxSize: config.fallbackSize });

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
      const animal = await guard.fire();
      fallback.remember(animal);
      return { animal, degradado: false };
    } catch (error) {
      const motivo = failureReason(error);
      const lastKnown = fallback.pick();

      if (!lastKnown) {
        throw new DependencyUnavailableError(motivo, error);
      }

      if (onDegraded) {
        onDegraded(motivo);
      }
      return { animal: lastKnown, degradado: true, motivo };
    }
  };

  // Fills the fallback at start-up so the first failure can already degrade.
  // Best effort: a database that is down at boot must not stop the API.
  const warmUp = async () => {
    if (!guard || typeof service.getAll !== 'function') {
      return 0;
    }
    try {
      const animals = await service.getAll();
      animals.slice(0, config.fallbackSize).forEach(fallback.remember);
    } catch (error) {
      // the guard and the fallback will cover the next requests
    }
    return fallback.size();
  };

  return {
    getRandom,
    warmUp,
    fallbackSize: () => fallback.size(),
    breakerState: () => (guard ? guard.state() : 'disabled'),
    shutdown: () => guard && guard.shutdown()
  };
};

module.exports = {
  DependencyUnavailableError,
  createResilientAnimalService
};
