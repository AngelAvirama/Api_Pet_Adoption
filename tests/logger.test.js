const logger = require('../src/config/logger');
const { runWithContext } = require('../src/config/requestContext');

describe('logger', () => {
  let output;

  beforeEach(() => {
    output = [];
    jest.spyOn(console, 'log').mockImplementation((line) => output.push(JSON.parse(line)));
  });

  afterEach(() => jest.restoreAllMocks());

  test('writes the trace id of the current request on every line', () => {
    runWithContext({ traceId: 'prueba-angel-0002' }, () => {
      logger.info('hola');
      logger.warn('cuidado');
      logger.error('fallo');
    });

    expect(output.map((entry) => entry.traceId)).toEqual([
      'prueba-angel-0002',
      'prueba-angel-0002',
      'prueba-angel-0002'
    ]);
    expect(output.map((entry) => entry.level)).toEqual(['info', 'warn', 'error']);
  });

  test('uses unknown outside a request', () => {
    logger.info('sin peticion');

    expect(output[0].traceId).toBe('unknown');
  });
});
