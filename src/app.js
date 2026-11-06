const express = require('express');

const animalRoutes = require('./routes/animal.routes');
const adoptanteRoutes = require('./routes/adoptante.routes');
const adopcionRoutes = require('./routes/adopcion.routes');
const errorHandler = require('./middlewares/error.middleware');
const traceIdMiddleware = require('./middlewares/traceId.middleware');
const versionMiddleware = require('./middlewares/version.middleware');
const v3Routes = require('./v3/routes');
const v4Routes = require('./v4/routes');
const metricsMiddleware = require('./middlewares/metrics.middleware');
const { register } = require('./config/metrics');

const app = express();

app.use(traceIdMiddleware);
app.use(versionMiddleware);
app.use(metricsMiddleware);
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Pet Adoption API is running'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/animals', animalRoutes);
app.use('/api/adoptantes', adoptanteRoutes);
app.use('/api/adopciones', adopcionRoutes);

app.use('/api/v3', v3Routes);
app.use('/api/v4', v4Routes);
app.use(errorHandler);

module.exports = app;
