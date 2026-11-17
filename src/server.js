require('dotenv').config();

const app = require('./app');
const { resilientAnimalService } = require('./resilience');
const chaos = require('./chaos');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Keeps the chaos switch snapshot fresh even without traffic
  chaos.cache.start();

  resilientAnimalService.warmUp().then((size) => {
    console.log(`Resilience fallback warmed with ${size} animals`);
  });
});