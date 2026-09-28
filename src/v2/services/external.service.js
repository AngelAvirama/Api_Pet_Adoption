const getExternalData = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`External API error: ${response.status}`);
  }

  return response.json();
};

const getRandomVuelo = () => {
  const url = `${process.env.JUAN_API_URL}/api/v2/entidades/vuelos/random`;
  return getExternalData(url);
};

const getRandomImagen = () => {
  const url = `${process.env.LEONARDO_API_URL}/api/v2/imagenes/random`;
  return getExternalData(url);
};

module.exports = {
  getRandomVuelo,
  getRandomImagen
};