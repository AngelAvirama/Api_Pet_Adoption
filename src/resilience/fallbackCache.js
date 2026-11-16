// Bounded in-memory copy of the last animals read from the database. It is
// the "last known good" data used for graceful degradation when the database
// cannot be reached. Animals are synthetic seed data, so serving a slightly
// stale one is acceptable for this read-only route.
const createFallbackCache = ({ maxSize = 50, random = Math.random } = {}) => {
  const animals = new Map();

  const remember = (animal) => {
    if (!animal || animal.id === undefined) {
      return;
    }
    animals.delete(animal.id);
    animals.set(animal.id, animal);
    while (animals.size > maxSize) {
      animals.delete(animals.keys().next().value);
    }
  };

  const pick = () => {
    if (animals.size === 0) {
      return null;
    }
    const values = [...animals.values()];
    return values[Math.floor(random() * values.length)];
  };

  return {
    remember,
    pick,
    size: () => animals.size
  };
};

module.exports = {
  createFallbackCache
};
