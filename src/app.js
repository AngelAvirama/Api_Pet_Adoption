const express = require('express');

const animalRoutes = require('./routes/animal.routes');
const adoptanteRoutes = require('./routes/adoptante.routes');
const adopcionRoutes = require('./routes/adopcion.routes');
const errorHandler = require('./middlewares/error.middleware');
const traceIdMiddleware = require('./middlewares/traceId.middleware');
const v2Routes = require('./v2/routes');

const app = express();

app.use(traceIdMiddleware);
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

app.use('/api/animals', animalRoutes);
app.use('/api/adoptantes', adoptanteRoutes);
app.use('/api/adopciones', adopcionRoutes);

app.use('/api/v2', v2Routes);

app.use(errorHandler);

module.exports = app;