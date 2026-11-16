const { createDatabaseFaultInjector, DatabaseUnavailableError } = require('../src/chaos/inject');

const cacheWith = (fault) => ({ get: jest.fn().mockResolvedValue(fault) });

describe('database fault injector', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('does nothing without an active fault', async () => {
    const inject = createDatabaseFaultInjector({ cache: cacheWith(null) });
    await expect(inject('op')).resolves.toBeUndefined();
  });

  test('throws a P1001-like error when the fault hits', async () => {
    const onInjected = jest.fn();
    const inject = createDatabaseFaultInjector({
      cache: cacheWith({ error_rate: 1, latency_ms: 0 }),
      random: () => 0.5,
      onInjected
    });

    const error = await inject('animal.findRandom').catch((e) => e);

    expect(error).toBeInstanceOf(DatabaseUnavailableError);
    expect(error.code).toBe('P1001');
    expect(onInjected).toHaveBeenCalledWith('animal.findRandom');
  });

  test('lets the call through when the random draw misses', async () => {
    const inject = createDatabaseFaultInjector({
      cache: cacheWith({ error_rate: 0.3, latency_ms: 0 }),
      random: () => 0.9
    });
    await expect(inject('op')).resolves.toBeUndefined();
  });

  test('adds the configured latency', async () => {
    const inject = createDatabaseFaultInjector({ cache: cacheWith({ error_rate: 0, latency_ms: 30 }) });
    const start = Date.now();
    await inject('op');
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });
});
