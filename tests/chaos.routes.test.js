const express = require('express');
const request = require('supertest');
const { createChaosRouter, tokenMatches, validateBody } = require('../src/chaos/routes');
const { createMemoryStore } = require('../src/chaos/store');

const TOKEN = 'token-local-de-desarrollo-123';

const buildApp = (env) => {
  const store = createMemoryStore();
  const cache = { invalidate: jest.fn() };
  const app = express();
  app.use(express.json());
  app.use('/internal/chaos', createChaosRouter({ store, cache, env }));
  app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
  return { app, store, cache };
};

describe('chaos switch routes', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('does not exist when CHAOS_ENABLED is not true', async () => {
    const { app } = buildApp({ CHAOS_TOKEN: TOKEN });
    const res = await request(app).get('/internal/chaos').set('X-Chaos-Token', TOKEN);
    expect(res.status).toBe(404);
  });

  test('refuses to work with a short token', async () => {
    const { app } = buildApp({ CHAOS_ENABLED: 'true', CHAOS_TOKEN: 'corto' });
    const res = await request(app).get('/internal/chaos').set('X-Chaos-Token', 'corto');
    expect(res.status).toBe(503);
  });

  test('rejects calls without the right token', async () => {
    const { app } = buildApp({ CHAOS_ENABLED: 'true', CHAOS_TOKEN: TOKEN });
    expect((await request(app).get('/internal/chaos')).status).toBe(401);
    expect((await request(app).get('/internal/chaos').set('X-Chaos-Token', 'x'.repeat(29))).status).toBe(401);
  });

  test('activates, lists and removes a fault', async () => {
    const { app, cache } = buildApp({ CHAOS_ENABLED: 'true', CHAOS_TOKEN: TOKEN });

    const created = await request(app)
      .post('/internal/chaos')
      .set('X-Chaos-Token', TOKEN)
      .send({ error_rate: 1, ttl_seconds: 300, motivo: 'ronda 0' });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ dependencia: 'database', error_rate: 1, motivo: 'ronda 0' });
    expect(created.body.segundos_restantes).toBeGreaterThan(298);
    expect(cache.invalidate).toHaveBeenCalled();

    const listed = await request(app).get('/internal/chaos').set('X-Chaos-Token', TOKEN);
    expect(listed.body).toHaveLength(1);

    const removed = await request(app).delete('/internal/chaos').set('X-Chaos-Token', TOKEN);
    expect(removed.body).toEqual({ eliminados: 1 });

    const empty = await request(app).get('/internal/chaos').set('X-Chaos-Token', TOKEN);
    expect(empty.body).toEqual([]);
  });

  test('validates the body', async () => {
    const { app } = buildApp({ CHAOS_ENABLED: 'true', CHAOS_TOKEN: TOKEN });
    const res = await request(app)
      .post('/internal/chaos')
      .set('X-Chaos-Token', TOKEN)
      .send({ error_rate: 1, ttl_seconds: 5000 });
    expect(res.status).toBe(400);
  });

  test('passes store errors to the error handler', async () => {
    const { app, store } = buildApp({ CHAOS_ENABLED: 'true', CHAOS_TOKEN: TOKEN });
    store.read = jest.fn().mockRejectedValue(new Error('ssm down'));
    store.write = jest.fn().mockRejectedValue(new Error('ssm down'));
    store.clear = jest.fn().mockRejectedValue(new Error('ssm down'));

    expect((await request(app).get('/internal/chaos').set('X-Chaos-Token', TOKEN)).status).toBe(500);
    expect((await request(app).post('/internal/chaos').set('X-Chaos-Token', TOKEN).send({ error_rate: 1, ttl_seconds: 10 })).status).toBe(500);
    expect((await request(app).delete('/internal/chaos').set('X-Chaos-Token', TOKEN)).status).toBe(500);
  });

  test('tokenMatches compares in constant time and checks length', () => {
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
    expect(tokenMatches(undefined, TOKEN)).toBe(false);
    expect(tokenMatches('otro', TOKEN)).toBe(false);
  });

  test('validateBody reports every problem', () => {
    expect(validateBody({ ttl_seconds: 10 }).errors).toEqual(['Indique error_rate o latency_ms mayor que cero']);
    expect(validateBody({ error_rate: 2, latency_ms: -1, ttl_seconds: 0, motivo: 5, otro: 1 }).errors).toHaveLength(5);
    expect(validateBody({ latency_ms: 500, ttl_seconds: 10 }).errors).toEqual([]);
    expect(validateBody().errors.length).toBeGreaterThan(0);
  });
});
