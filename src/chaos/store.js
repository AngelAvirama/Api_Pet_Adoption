// State of the chaos switch: which fault is active on the database
// dependency and until when. Two backends with the same interface:
//
// - memory: one process (local rounds and tests).
// - ssm: an AWS SSM Parameter Store parameter shared by every ECS task.
//   It does not live in the database on purpose: the experiment takes the
//   database down, and the switch must keep working while it is down.
//
// A fault always has an expiry (TTL, max 15 minutes). An expired fault is
// treated as absent: that is the automatic rollback if nobody removes it.
const MAX_TTL_SECONDS = 900;
const MAX_LATENCY_MS = 10000;

const isActive = (fault, now = Date.now()) =>
  Boolean(fault) && new Date(fault.expires_at).getTime() > now;

const withRemaining = (fault, now = Date.now()) => ({
  ...fault,
  segundos_restantes: Math.max(
    0,
    Math.round((new Date(fault.expires_at).getTime() - now) / 1000)
  )
});

const buildFault = ({ errorRate = 0, latencyMs = 0, ttlSeconds, motivo = null, creadoPor = null }, now = Date.now()) => ({
  dependencia: 'database',
  error_rate: errorRate,
  latency_ms: latencyMs,
  expires_at: new Date(now + ttlSeconds * 1000).toISOString(),
  created_at: new Date(now).toISOString(),
  motivo,
  creado_por: creadoPor
});

const createMemoryStore = () => {
  let fault = null;

  return {
    backend: 'memory',
    async read() {
      return fault;
    },
    async write(next) {
      fault = next;
      return fault;
    },
    async clear() {
      const removed = fault ? 1 : 0;
      fault = null;
      return removed;
    }
  };
};

const createSsmStore = ({ parameterName, client }) => {
  const {
    GetParameterCommand,
    PutParameterCommand,
    DeleteParameterCommand
  } = require('@aws-sdk/client-ssm');

  const isNotFound = (error) => error?.name === 'ParameterNotFound';

  return {
    backend: 'ssm',
    async read() {
      try {
        const result = await client.send(new GetParameterCommand({ Name: parameterName }));
        const value = result.Parameter?.Value;
        return value ? JSON.parse(value) : null;
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }
        throw error;
      }
    },
    async write(next) {
      await client.send(new PutParameterCommand({
        Name: parameterName,
        Value: JSON.stringify(next),
        Type: 'String',
        Overwrite: true
      }));
      return next;
    },
    async clear() {
      try {
        await client.send(new DeleteParameterCommand({ Name: parameterName }));
        return 1;
      } catch (error) {
        if (isNotFound(error)) {
          return 0;
        }
        throw error;
      }
    }
  };
};

const createStoreFromEnv = (env = process.env) => {
  if (env.CHAOS_STATE_BACKEND === 'ssm') {
    const { SSMClient } = require('@aws-sdk/client-ssm');

    return createSsmStore({
      parameterName: env.CHAOS_SSM_PARAMETER || '/pet-adoption/demo/chaos-fault',
      client: new SSMClient({ region: env.AWS_REGION || 'us-east-1' })
    });
  }

  return createMemoryStore();
};

// Per-task cache in front of the store, so the request path never waits for
// SSM: requests read the last snapshot. start() refreshes it every ttlMs in
// the background, with or without traffic, so a task that received no
// requests never serves a fault that was already removed in another task
// (the snapshot is at most ttlMs old). If the store cannot be read
// maxFailures times in a row, the cache falls back to "no fault": a broken
// switch must never leave a fault stuck on.
const createFaultCache = ({ store, ttlMs = 3000, maxFailures = 3, onChange, log } = {}) => {
  let snapshot = null;
  let fetchedAt = 0;
  let inflight = null;
  let failures = 0;

  const publish = () => {
    if (onChange) {
      onChange(isActive(snapshot) ? snapshot : null);
    }
  };

  const refresh = async () => {
    try {
      snapshot = await store.read();
      failures = 0;
    } catch (error) {
      failures += 1;
      if (log) {
        log('chaos_store_error', { intentos: failures, detalle: error.message });
      }
      if (failures >= maxFailures) {
        snapshot = null;
      }
    } finally {
      fetchedAt = Date.now();
      publish();
    }
  };

  const get = async () => {
    if (fetchedAt === 0 || ttlMs <= 0) {
      await refresh();
    } else if (Date.now() - fetchedAt > ttlMs && !inflight) {
      inflight = refresh().finally(() => {
        inflight = null;
      });
    }

    return isActive(snapshot) ? snapshot : null;
  };

  const invalidate = () => {
    fetchedAt = 0;
  };

  let timer = null;

  const start = () => {
    if (!timer && ttlMs > 0) {
      timer = setInterval(() => {
        if (!inflight) {
          inflight = refresh().finally(() => {
            inflight = null;
          });
        }
      }, ttlMs);
      timer.unref();
    }
  };

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  return { get, refresh, invalidate, start, stop };
};

module.exports = {
  MAX_TTL_SECONDS,
  MAX_LATENCY_MS,
  isActive,
  withRemaining,
  buildFault,
  createMemoryStore,
  createSsmStore,
  createStoreFromEnv,
  createFaultCache
};
