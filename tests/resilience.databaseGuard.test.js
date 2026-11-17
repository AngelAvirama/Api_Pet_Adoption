const { createDatabaseGuard, failureReason, BREAKER_STATE } = require('../src/resilience/databaseGuard');
const { resilienceConfig } = require('../src/resilience/config');

const config = {
  ...resilienceConfig({}),
  timeoutMs: 50,
  breaker: { errorThresholdPercentage: 50, volumeThreshold: 2, resetTimeout: 100, rollingCountTimeout: 1000 }
};

describe('database guard (timeout + circuit breaker)', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('passes results through while the database answers', async () => {
    const guard = createDatabaseGuard({ name: 't1', action: async () => ({ id: 1 }), config });
    await expect(guard.fire()).resolves.toEqual({ id: 1 });
    expect(guard.state()).toBe('closed');
    guard.shutdown();
  });

  test('cuts slow calls at the timeout', async () => {
    const guard = createDatabaseGuard({
      name: 't2',
      action: () => new Promise((resolve) => setTimeout(resolve, 500)),
      config
    });
    const start = Date.now();
    const error = await guard.fire().catch((e) => e);
    expect(failureReason(error)).toBe('timeout');
    expect(Date.now() - start).toBeLessThan(300);
    guard.shutdown();
  });

  test('opens after repeated failures, fails fast, and closes again', async () => {
    const onStateChange = jest.fn();
    let healthy = false;
    const action = jest.fn(async () => {
      if (!healthy) {
        const error = new Error('db down');
        error.code = 'P1001';
        throw error;
      }
      return { id: 2 };
    });
    const guard = createDatabaseGuard({ name: 't3', action, config, onStateChange });

    expect(failureReason(await guard.fire().catch((e) => e))).toBe('error_base_de_datos');
    await guard.fire().catch(() => {});
    expect(guard.state()).toBe('open');
    expect(onStateChange).toHaveBeenCalledWith('t3', BREAKER_STATE.open);

    const callsBefore = action.mock.calls.length;
    expect(failureReason(await guard.fire().catch((e) => e))).toBe('circuito_abierto');
    expect(action.mock.calls.length).toBe(callsBefore);

    healthy = true;
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(guard.state()).toBe('halfOpen');
    await expect(guard.fire()).resolves.toEqual({ id: 2 });
    expect(guard.state()).toBe('closed');
    expect(onStateChange).toHaveBeenCalledWith('t3', BREAKER_STATE.closed);
    guard.shutdown();
  });
});
