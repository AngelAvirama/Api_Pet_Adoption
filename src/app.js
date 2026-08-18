const express = require('express');

const animalRoutes = require('./routes/animal.routes');
const adoptanteRoutes = require('./routes/adoptante.routes');
const adopcionRoutes = require('./routes/adopcion.routes');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Pet Adoption API is running'
  });
});

app.use('/api/animals', animalRoutes);
app.use('/api/adoptantes', adoptanteRoutes);
app.use('/api/adopciones', adopcionRoutes);

module.exports = app;