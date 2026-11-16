const { setTimeout: sleep } = require('timers/promises');
const logger = require('../config/logger');

// Error raised when the switch simulates that the database cannot be reached.
// It mimics Prisma's P1001 ("Can't reach database server"), which is what the
// API sees when RDS is down, so the rest of the code reacts exactly as it
// would in the real failure.
class DatabaseUnavailableError extends Error {
  constructor() {
    super("Can't reach database server (fault injected by the chaos switch)");
    this.name = 'DatabaseUnavailableError';
    this.code = 'P1001';
    this.injected = true;
  }
}

const createDatabaseFaultInjector = ({ cache, random = Math.random, onInjected } = {}) =>
  async (operation) => {
    const fault = await cache.get();

    if (!fault) {
      return;
    }

    if (fault.latency_ms > 0) {
      await sleep(fault.latency_ms);
    }

    if (fault.error_rate > 0 && random() < fault.error_rate) {
      if (onInjected) {
        onInjected(operation);
      }
      logger.warn('Injected database failure', {
        evento: 'chaos_fallo_inyectado',
        dependencia: 'database',
        operacion: operation
      });
      throw new DatabaseUnavailableError();
    }
  };

module.exports = {
  DatabaseUnavailableError,
  createDatabaseFaultInjector
};
