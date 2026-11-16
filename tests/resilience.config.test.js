const request = require('supertest');
const express = require('express');
const { isResilienceEnabled, getRound, resilienceConfig, roundMiddleware } = require('../src/resilience/config');

describe('resilience configuration', () => {
  test('round follows RESILIENCE_ENABLED', () => {
    expect(isResilienceEnabled({})).toBe(false);
    expect(getRound({})).toBe('0');
    expect(getRound({ RESILIENCE_ENABLED: 'true' })).toBe('1');
  });

  test('uses defaults and accepts overrides', () => {
    expect(resilienceConfig({})).toMatchObject({ enabled: false, timeoutMs: 1000, fallbackSize: 50 });
    const tuned = resilienceConfig({ RESILIENCE_ENABLED: 'true', DB_TIMEOUT_MS: '500', BREAKER_RESET_MS: 'x' });
    expect(tuned.timeoutMs).toBe(500);
    expect(tuned.breaker.resetTimeout).toBe(10000);
  });

  test('every response carries X-Ronda', async () => {
    const previous = process.env.RESILIENCE_ENABLED;
    process.env.RESILIENCE_ENABLED = 'true';
    const app = express();
    app.use(roundMiddleware);
    app.get('/', (req, res) => res.send('ok'));

    const res = await request(app).get('/');

    expect(res.headers['x-ronda']).toBe('1');
    process.env.RESILIENCE_ENABLED = previous;
  });
});
