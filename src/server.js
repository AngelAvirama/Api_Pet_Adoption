require('dotenv').config();

const app = require('./app');
const { resilientAnimalService } = require('./resilience');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  resilientAnimalService.warmUp().then((size) => {
    console.log(`Resilience fallback warmed with ${size} animals`);
  });
});