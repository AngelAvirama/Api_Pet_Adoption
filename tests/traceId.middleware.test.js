const traceIdMiddleware = require('../src/middlewares/traceId.middleware');
const { resolveTraceId } = require('../src/middlewares/traceId.middleware');

const buildReq = (headers = {}) => ({
  get: (name) => headers[name.toLowerCase()]
});

const buildRes = () => {
  const headers = {};
  return {
    headers,
    setHeader: (name, value) => {
      headers[name] = value;
    }
  };
};

describe('traceId middleware', () => {
  test('keeps the X-Trace-Id sent by the coordinator', () => {
    const req = buildReq({ 'x-trace-id': 'prueba-angel-0001' });
    const res = buildRes();
    const next = jest.fn();

    traceIdMiddleware(req, res, next);

    expect(req.traceId).toBe('prueba-angel-0001');
    expect(res.headers['X-Trace-Id']).toBe('prueba-angel-0001');
    expect(next).toHaveBeenCalled();
  });

  test('generates a trace id when none is received', () => {
    const req = buildReq();
    const res = buildRes();

    traceIdMiddleware(req, res, jest.fn());

    expect(req.traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['X-Trace-Id']).toBe(req.traceId);
  });

  test('prefers the incoming id over the OpenTelemetry one', () => {
    expect(resolveTraceId('k6-r0-1-1', 'abc123')).toBe('k6-r0-1-1');
  });

  test('falls back to the OpenTelemetry id when the incoming one is invalid', () => {
    expect(resolveTraceId('bad id <script>', 'abc123')).toBe('abc123');
    expect(resolveTraceId('x'.repeat(200), 'abc123')).toBe('abc123');
    expect(resolveTraceId(undefined, 'abc123')).toBe('abc123');
  });
});
