const { createFallbackCache } = require('../src/resilience/fallbackCache');

describe('fallback cache', () => {
  test('keeps the most recent animals up to its size', () => {
    const cache = createFallbackCache({ maxSize: 2, random: () => 0 });

    expect(cache.pick()).toBeNull();
    cache.remember({ id: 1 });
    cache.remember({ id: 2 });
    cache.remember({ id: 1 });
    cache.remember({ id: 3 });
    cache.remember(null);
    cache.remember({ nombre: 'sin id' });

    expect(cache.size()).toBe(2);
    expect(cache.pick()).toEqual({ id: 1 });
  });
});
