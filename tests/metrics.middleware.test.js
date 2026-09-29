const express = require('express');
const request = require('supertest');

const { register } = require('../src/config/metrics');
const metricsMiddleware = require('../src/middlewares/metrics.middleware');

describe('metrics middleware', () => {
  const app = express();
  app.use(metricsMiddleware);
  const router = express.Router();
  router.get('/animals/random', (req, res) => res.json({ ok: true }));
  router.get('/animals/:id', (req, res) => res.json({ id: req.params.id }));
  app.use('/api/v2', router);

  it('etiqueta la ruta completa con el prefijo del router', async () => {
    await request(app).get('/api/v2/animals/random');
    await request(app).get('/api/v2/animals/7?x=1');

    const output = await register.getSingleMetricAsString('http_requests_total');
    expect(output).toContain('route="/api/v2/animals/random"');
    expect(output).toContain('route="/api/v2/animals/:id"');
    expect(output).not.toContain('route="/animals/random"');
  });
});
