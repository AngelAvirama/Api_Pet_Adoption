const versionMiddleware = (req, res, next) => {
  const version = process.env.APP_VERSION || 'v3';
  const track = process.env.APP_TRACK || 'stable';

  // Identificar la versión y el track en la solicitud
  req.appVersion = version;
  req.appTrack = track;

  // Identificar la versión y el track en la respuesta
  res.setHeader('X-App-Version', version);
  res.setHeader('X-App-Track', track);

  next();
};

module.exports = versionMiddleware;