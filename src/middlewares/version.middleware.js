const versionMiddleware = (req, res, next) => {
  const version = process.env.APP_VERSION || 'v3';
  const track = process.env.APP_TRACK || 'stable';

  res.setHeader('X-App-Version', version);
  res.setHeader('X-App-Track', track);

  next();
};

module.exports = versionMiddleware;
