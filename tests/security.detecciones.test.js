const { coincide, evaluarRegla, cargarReglas } = require('../chaos/security/detecciones/evaluar');
const { decidir } = require('../security/lambda/revocar-ingreso-publico/decidir');

describe('detection as code (experiment 2)', () => {
  test('every rule fires on its positive cases and stays silent on the negative ones', () => {
    const resultados = cargarReglas().map(evaluarRegla);
    expect(resultados.length).toBeGreaterThan(0);
    resultados.forEach((r) => {
      expect(r.positivos.filter((c) => !c.dispara)).toEqual([]);
      expect(r.negativos.filter((c) => c.dispara)).toEqual([]);
    });
  });

  test('the pattern matcher supports values, arrays and exists', () => {
    expect(coincide({ a: ['x'] }, { a: 'x' })).toBe(true);
    expect(coincide({ a: ['x'] }, { a: ['y', 'x'] })).toBe(true);
    expect(coincide({ a: [{ exists: false }] }, {})).toBe(true);
    expect(coincide({ a: { b: ['z'] } }, { a: { b: 'q' } })).toBe(false);
    expect(coincide({ a: 'x' }, undefined)).toBe(false);
  });

  test('the decision extracts the rule to revoke and who opened it', () => {
    const [regla] = cargarReglas();
    const decision = decidir(regla.casos.positivos[0].entrada, regla.grupos_protegidos);
    expect(decision).toMatchObject({
      exposicion: true,
      grupo: 'sg-ecs-ejemplo',
      reglas: ['sgr-0abc'],
      cidrs: ['0.0.0.0/0'],
      actor: 'arn:aws:iam::296121913016:user/angel',
      origen_ip: '190.1.2.3'
    });
    expect(decidir(regla.casos.positivos[2].entrada, regla.grupos_protegidos).reglas).toEqual(['sgr-0ghi']);
    expect(decidir(undefined).exposicion).toBe(false);
    expect(decidir({ detail: { eventSource: 'ec2.amazonaws.com', eventName: 'AuthorizeSecurityGroupIngress', requestParameters: { groupId: 'sg-x' } } }, ['sg-x']).motivo)
      .toBe('cambio sin origen publico');
  });
});
