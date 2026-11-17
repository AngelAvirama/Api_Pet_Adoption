const { crearHandler } = require('../security/lambda/revocar-ingreso-publico');
const { cargarReglas } = require('../chaos/security/detecciones/evaluar');

class RevokeSecurityGroupIngressCommand { constructor(input) { this.input = input; this.tipo = 'revoke'; } }
class PublishCommand { constructor(input) { this.input = input; this.tipo = 'publish'; } }

const regla = cargarReglas()[0];
const positivo = regla.casos.positivos[0].entrada;
const negativo = regla.casos.negativos[0].entrada;

const construir = (env, fallos = {}) => {
  const enviados = [];
  const cliente = (tipo) => ({
    send: jest.fn(async (cmd) => {
      if (fallos[tipo]) throw new Error(fallos[tipo]);
      enviados.push(cmd);
      return {};
    })
  });
  const handler = crearHandler({
    ec2: cliente('revoke'),
    sns: cliente('publish'),
    comandos: { RevokeSecurityGroupIngressCommand, PublishCommand },
    env: { PROTECTED_GROUPS: 'sg-ecs-ejemplo, sg-rds-ejemplo', ...env }
  });
  return { handler, enviados };
};

describe('remediation Lambda', () => {
  let logs;
  beforeEach(() => {
    logs = [];
    jest.spyOn(console, 'log').mockImplementation((l) => logs.push(JSON.parse(l)));
  });
  afterEach(() => jest.restoreAllMocks());

  test('contains the exposure: revokes the rule and alerts', async () => {
    const { handler, enviados } = construir({ REMEDIATION_MODE: 'contener', ALERT_TOPIC_ARN: 'arn:sns:x' });

    const r = await handler(positivo);

    expect(r).toMatchObject({ exposicion: true, revocadas: ['sgr-0abc'], alerta_enviada: true });
    expect(enviados[0].input).toEqual({ GroupId: 'sg-ecs-ejemplo', SecurityGroupRuleIds: ['sgr-0abc'] });
    expect(enviados[1].input.Subject).toMatch(/sg-ecs-ejemplo/);
    expect(logs.map((l) => l.evento)).toEqual(['exposicion_detectada', 'exposicion_contenida']);
  });

  test('only detects when the mode is not contener', async () => {
    const { handler, enviados } = construir({});
    const r = await handler(positivo);
    expect(r.revocadas).toEqual([]);
    expect(enviados).toEqual([]);
  });

  test('ignores normal changes of the platform', async () => {
    const { handler, enviados } = construir({ REMEDIATION_MODE: 'contener', ALERT_TOPIC_ARN: 'arn:sns:x' });
    const r = await handler(negativo);
    expect(r.exposicion).toBe(false);
    expect(enviados).toEqual([]);
    expect(logs[0].evento).toBe('cambio_sin_exposicion');
  });

  test('a failed revoke or alert is logged and does not stop the other action', async () => {
    const { handler } = construir({ REMEDIATION_MODE: 'contener', ALERT_TOPIC_ARN: 'arn:sns:x' }, { revoke: 'AccessDenied', publish: 'Throttled' });
    const r = await handler(positivo);
    expect(r).toMatchObject({ revocadas: [], alerta_enviada: false });
    expect(logs.map((l) => l.evento)).toEqual(['exposicion_detectada', 'contencion_fallida', 'alerta_fallida']);
  });
});
