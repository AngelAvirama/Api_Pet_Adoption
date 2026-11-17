const reglas = require('../chaos/security/exp2-exposicion/reglas');

const ids = { alb: 'sg-alb', ecs: 'sg-ecs', rds: 'sg-rds' };
const regla = (extra) => reglas.normalizar({
  SecurityGroupRuleId: `sgr-${Math.random().toString(36).slice(2, 7)}`,
  IsEgress: false,
  IpProtocol: 'tcp',
  ...extra
});

const declaradas = [
  regla({ GroupId: 'sg-alb', FromPort: 80, ToPort: 80, CidrIpv4: '0.0.0.0/0' }),
  regla({ GroupId: 'sg-ecs', FromPort: 3000, ToPort: 3000, ReferencedGroupInfo: { GroupId: 'sg-alb' } }),
  regla({ GroupId: 'sg-rds', FromPort: 5432, ToPort: 5432, ReferencedGroupInfo: { GroupId: 'sg-ecs' } })
];

describe('experiment 2: exposure and segmentation', () => {
  test('the declared state has no unexpected ingress', () => {
    const auditoria = reglas.auditar(declaradas, ids);
    expect(auditoria.inesperadas).toEqual([]);
    expect(auditoria.entrada_publica_en_grupos_privados).toEqual([]);
  });

  test('flags a public rule on a private group and unfiltered egress', () => {
    const abierta = regla({ GroupId: 'sg-ecs', FromPort: 3000, ToPort: 3000, CidrIpv4: '0.0.0.0/0', Description: 'chaos-exp2 ronda 0 ecs' });
    const salida = reglas.normalizar({ SecurityGroupRuleId: 'sgr-e', GroupId: 'sg-ecs', IsEgress: true, IpProtocol: '-1', CidrIpv4: '0.0.0.0/0' });
    const auditoria = reglas.auditar([...declaradas, abierta, salida], ids);

    expect(auditoria.inesperadas).toHaveLength(1);
    expect(auditoria.entrada_publica_en_grupos_privados[0].id).toBe(abierta.id);
    expect(auditoria.salida_sin_filtrar).toEqual(['ecs']);
    expect(reglas.esDelExperimento(abierta)).toBe(true);
    expect(reglas.esPublica(regla({ CidrIpv6: '::/0' }))).toBe(true);
  });

  test('builds the adverse rule tagged for the rollback', () => {
    const [permiso] = reglas.permisoAdverso('ecs', '1');
    expect(permiso).toMatchObject({ IpProtocol: 'tcp', FromPort: 3000, ToPort: 3000 });
    expect(permiso.IpRanges[0]).toEqual({ CidrIp: '0.0.0.0/0', Description: 'chaos-exp2 ronda 1 ecs' });
    expect(reglas.permisoAdverso('rds', '0')[0].FromPort).toBe(5432);
    expect(() => reglas.permisoAdverso('salida', '0')).toThrow();
  });

  test('round 0: exposed, signals recorded but nobody alerted, not contained', () => {
    const resumen = reglas.resumir({
      estado_estable: { alertas_sin_condicion_adversa: 0 },
      aperturas: [{ caso: 'ecs', t: '2026-11-17T10:00:00Z' }],
      vigilancia: { ecs: { alcanzable: true, contenida_por_control: false } },
      mediciones: {
        cloudtrail: { ecs: { t: '2026-11-17T10:00:01Z' } },
        app: { ecs: { t: '2026-11-17T10:00:06Z' } },
        alertas: {},
        alarmas_app: {}
      },
      salida: { t: '2026-11-17T10:10:00Z', prohibido_conecta: true }
    });

    expect(resumen.senal_registrada).toBe('1/2');
    expect(resumen.cobertura_deteccion).toBe('0/2');
    expect(resumen.contencion).toBe('0/2');
    expect(resumen.tecnicas[0]).toMatchObject({
      expuesto: true, senales: ['cloudtrail', 'log_app'], t_senal_s: 1, detectado: false, mttd_s: null, mttc_s: null
    });
    expect(resumen.falsos_positivos).toBe(0);
  });

  test('round 1: alerted by EventBridge and the app alarm, contained by the control', () => {
    const resumen = reglas.resumir({
      aperturas: [
        { caso: 'ecs', t: '2026-11-17T10:00:00Z' },
        { caso: 'rds', t: '2026-11-17T10:05:00Z' }
      ],
      vigilancia: {
        ecs: { alcanzable: true, contenida_por_control: true, t_regla_retirada: '2026-11-17T10:01:30Z' },
        rds: { alcanzable: false, contenida_por_control: true, t_regla_retirada: '2026-11-17T10:06:10Z' }
      },
      mediciones: {
        alertas: { ecs: { t: '2026-11-17T10:01:05Z' }, rds: { t: '2026-11-17T10:06:00Z' } },
        alarmas_app: { ecs: { t: '2026-11-17T10:00:50Z' } }
      },
      salida: { t: '2026-11-17T10:10:00Z', prohibido_conecta: false }
    });

    expect(resumen.cobertura_deteccion).toBe('2/3');
    expect(resumen.contencion).toBe('3/3');
    expect(resumen.tecnicas[0]).toMatchObject({ detectado_por: ['eventbridge', 'alarma_app'], mttd_s: 50, mttc_s: 90 });
    expect(resumen.tecnicas[1]).toMatchObject({ mttd_s: 60, mttc_s: 70 });
    expect(resumen.tecnicas[2]).toMatchObject({ contenido: true, detectado: false });
    expect(reglas.resumir({}).cobertura_deteccion).toBe('0/0');
  });

  test('helpers', () => {
    expect(reglas.primeraMarca([{ t: 'a', ok: false }, { t: 'b', ok: true }], (m) => m.ok)).toBe('b');
    expect(reglas.primeraMarca(null, () => true)).toBeNull();
    expect(reglas.segundos(null, 'x')).toBeNull();
  });

  test('the runner loads without touching AWS', () => {
    const { comandos } = require('../chaos/security/exp2-exposicion/ejecutar');
    expect(Object.keys(comandos)).toEqual(['estado-estable', 'abrir', 'vigilar', 'salida', 'medir', 'revertir', 'informe']);
  });
});
