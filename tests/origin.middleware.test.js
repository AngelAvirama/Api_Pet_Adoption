const originMiddleware = require('../src/middlewares/origin.middleware');
const { classifyOrigin } = require('../src/middlewares/origin.middleware');
const { runWithContext } = require('../src/config/requestContext');

const buildReq = (headers = {}) => ({
  method: 'GET',
  originalUrl: '/api/v2/animals/random?x=1',
  socket: { remoteAddress: '190.1.2.3' },
  get: (name) => headers[name.toLowerCase()]
});

describe('origin middleware', () => {
  let lines;

  beforeEach(() => {
    lines = [];
    jest.spyOn(console, 'log').mockImplementation((line) => lines.push(JSON.parse(line)));
    process.env.ORIGIN_CHECK_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.ORIGIN_CHECK_ENABLED;
    jest.restoreAllMocks();
  });

  test('classifies traffic forwarded by the ALB and its health checks', () => {
    expect(classifyOrigin(buildReq({ 'x-forwarded-for': '200.1.1.1' }))).toEqual({ viaAlb: true, motivo: 'alb' });
    expect(classifyOrigin(buildReq({ 'user-agent': 'ELB-HealthChecker/2.0' }))).toEqual({ viaAlb: true, motivo: 'health_check_alb' });
    expect(classifyOrigin(buildReq({ 'user-agent': 'curl/8.5.0' }))).toEqual({ viaAlb: false, motivo: 'directo' });
  });

  test('logs a direct access with the trace id of the request', () => {
    const req = buildReq({ 'user-agent': 'curl/8.5.0' });
    const next = jest.fn();

    runWithContext({ traceId: 'exp2-r0-sonda' }, () => originMiddleware(req, {}, next));

    expect(next).toHaveBeenCalled();
    expect(req.viaAlb).toBe(false);
    expect(lines[0]).toMatchObject({
      level: 'warn',
      traceId: 'exp2-r0-sonda',
      evento: 'acceso_directo_sin_alb',
      route: '/api/v2/animals/random',
      ip: '190.1.2.3',
      agente: 'curl/8.5.0'
    });
  });

  test('stays silent for normal traffic and when the check is disabled', () => {
    originMiddleware(buildReq({ 'x-forwarded-for': '200.1.1.1' }), {}, jest.fn());
    originMiddleware(buildReq({ 'user-agent': 'ELB-HealthChecker/2.0' }), {}, jest.fn());
    delete process.env.ORIGIN_CHECK_ENABLED;
    originMiddleware(buildReq({}), {}, jest.fn());

    expect(lines).toEqual([]);
  });
});
