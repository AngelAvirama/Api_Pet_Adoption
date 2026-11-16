const {
  isActive,
  withRemaining,
  buildFault,
  createMemoryStore,
  createSsmStore,
  createStoreFromEnv,
  createFaultCache
} = require('../src/chaos/store');

describe('chaos fault store', () => {
  const now = Date.parse('2026-11-16T20:00:00Z');

  test('a fault is active until it expires', () => {
    const fault = buildFault({ errorRate: 1, ttlSeconds: 60 }, now);

    expect(isActive(fault, now + 59000)).toBe(true);
    expect(isActive(fault, now + 61000)).toBe(false);
    expect(isActive(null, now)).toBe(false);
    expect(withRemaining(fault, now + 30000).segundos_restantes).toBe(30);
    expect(withRemaining(fault, now + 90000).segundos_restantes).toBe(0);
  });

  test('memory store writes, reads and clears', async () => {
    const store = createMemoryStore();
    const fault = buildFault({ errorRate: 1, ttlSeconds: 60 });

    expect(await store.read()).toBeNull();
    await store.write(fault);
    expect(await store.read()).toEqual(fault);
    expect(await store.clear()).toBe(1);
    expect(await store.clear()).toBe(0);
  });

  test('ssm store maps the parameter to a fault', async () => {
    const fault = buildFault({ errorRate: 1, ttlSeconds: 60 });
    const sent = [];
    let value = null;
    const client = {
      send: jest.fn(async (command) => {
        sent.push(command.constructor.name);
        if (command.constructor.name === 'PutParameterCommand') {
          value = command.input.Value;
          return {};
        }
        if (value === null) {
          const error = new Error('not found');
          error.name = 'ParameterNotFound';
          throw error;
        }
        if (command.constructor.name === 'DeleteParameterCommand') {
          value = null;
          return {};
        }
        return { Parameter: { Value: value } };
      })
    };
    const store = createSsmStore({ parameterName: '/x', client });

    expect(await store.read()).toBeNull();
    await store.write(fault);
    expect(await store.read()).toEqual(fault);
    expect(await store.clear()).toBe(1);
    expect(await store.clear()).toBe(0);
    expect(sent).toContain('PutParameterCommand');
  });

  test('ssm store propagates unexpected errors', async () => {
    const client = { send: jest.fn().mockRejectedValue(new Error('AccessDenied')) };
    const store = createSsmStore({ parameterName: '/x', client });

    await expect(store.read()).rejects.toThrow('AccessDenied');
    await expect(store.clear()).rejects.toThrow('AccessDenied');
  });

  test('backend is chosen by CHAOS_STATE_BACKEND', () => {
    expect(createStoreFromEnv({}).backend).toBe('memory');
    expect(createStoreFromEnv({ CHAOS_STATE_BACKEND: 'ssm' }).backend).toBe('ssm');
  });

  test('cache serves the snapshot and ignores expired faults', async () => {
    const store = createMemoryStore();
    const onChange = jest.fn();
    const cache = createFaultCache({ store, ttlMs: 0, onChange });

    expect(await cache.get()).toBeNull();
    await store.write(buildFault({ errorRate: 1, ttlSeconds: 60 }));
    expect((await cache.get()).error_rate).toBe(1);
    await store.write(buildFault({ errorRate: 1, ttlSeconds: 60 }, Date.now() - 120000));
    expect(await cache.get()).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test('cache refreshes in the background after its ttl', async () => {
    const store = createMemoryStore();
    const cache = createFaultCache({ store, ttlMs: 10 });

    expect(await cache.get()).toBeNull();
    await store.write(buildFault({ errorRate: 1, ttlSeconds: 60 }));
    expect(await cache.get()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await cache.get();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await cache.get()).error_rate).toBe(1);
    cache.invalidate();
    expect((await cache.get()).error_rate).toBe(1);
  });

  test('cache falls back to no fault when the store keeps failing', async () => {
    const store = createMemoryStore();
    await store.write(buildFault({ errorRate: 1, ttlSeconds: 60 }));
    const log = jest.fn();
    const cache = createFaultCache({ store, ttlMs: 0, maxFailures: 2, log });

    expect(await cache.get()).not.toBeNull();
    store.read = jest.fn().mockRejectedValue(new Error('ssm down'));
    expect(await cache.get()).not.toBeNull();
    expect(await cache.get()).toBeNull();
    expect(log).toHaveBeenCalledWith('chaos_store_error', expect.objectContaining({ intentos: 2 }));
  });
});
