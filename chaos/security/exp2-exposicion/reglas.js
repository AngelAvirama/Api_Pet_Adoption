// Pure logic of experiment 2 (exposure and segmentation): what the security
// groups should look like, which rules the experiment opens, and how a round
// is summarised (MTTD, MTTC, coverage). No AWS calls here, so it is tested.
const MARCA = 'chaos-exp2';

// Adverse conditions emulated by the experiment (ATT&CK)
const CASOS = {
  ecs: {
    grupo: 'ecs',
    puerto: 3000,
    descripcion: 'Puerto de la app abierto a Internet saltando el ALB',
    attack: 'T1562.007 Impair Defenses: Disable or Modify Cloud Firewall'
  },
  rds: {
    grupo: 'rds',
    puerto: 5432,
    descripcion: 'Puerto de administracion de la base de datos abierto a Internet',
    attack: 'T1562.007 Impair Defenses: Disable or Modify Cloud Firewall'
  },
  salida: {
    grupo: 'ecs',
    puerto: 80,
    descripcion: 'Salida a Internet sin filtrar desde el task (puerto no permitido)',
    attack: 'T1048 Exfiltration Over Alternative Protocol'
  }
};

const normalizar = (regla) => ({
  id: regla.SecurityGroupRuleId,
  grupo: regla.GroupId,
  salida: Boolean(regla.IsEgress),
  protocolo: regla.IpProtocol,
  desde: regla.FromPort,
  hasta: regla.ToPort,
  cidr: regla.CidrIpv4 || regla.CidrIpv6 || null,
  origen: regla.ReferencedGroupInfo?.GroupId || null,
  descripcion: regla.Description || ''
});

const esPublica = (regla) => regla.cidr === '0.0.0.0/0' || regla.cidr === '::/0';

const esDelExperimento = (regla) => regla.descripcion.startsWith(MARCA);

// Declared state: the only public entry is HTTP to the ALB; the tasks only
// accept the ALB; the database only accepts the tasks.
const auditar = (reglas, ids) => {
  const entrada = reglas.filter((r) => !r.salida);
  const esperadas = [
    (r) => r.grupo === ids.alb && r.protocolo === 'tcp' && r.desde === 80 && esPublica(r),
    (r) => r.grupo === ids.alb && r.protocolo === 'tcp' && r.desde === 443 && esPublica(r),
    (r) => r.grupo === ids.ecs && r.protocolo === 'tcp' && r.desde === 3000 && r.origen === ids.alb,
    (r) => r.grupo === ids.rds && r.protocolo === 'tcp' && r.desde === 5432 && r.origen === ids.ecs
  ];
  const inesperadas = entrada.filter((r) => !esperadas.some((ok) => ok(r)));
  const salidaSinFiltrar = reglas
    .filter((r) => r.salida && r.protocolo === '-1' && esPublica(r))
    .map((r) => Object.keys(ids).find((k) => ids[k] === r.grupo) || r.grupo);

  return {
    inesperadas,
    salida_sin_filtrar: [...new Set(salidaSinFiltrar)],
    entrada_publica_en_grupos_privados: inesperadas.filter((r) => esPublica(r) && r.grupo !== ids.alb)
  };
};

const permisoAdverso = (caso, ronda) => {
  const definicion = CASOS[caso];
  if (!definicion || caso === 'salida') {
    throw new Error(`Caso de apertura desconocido: ${caso} (opciones: ecs, rds)`);
  }
  return [{
    IpProtocol: 'tcp',
    FromPort: definicion.puerto,
    ToPort: definicion.puerto,
    IpRanges: [{ CidrIp: '0.0.0.0/0', Description: `${MARCA} ronda ${ronda} ${caso}` }]
  }];
};

const primeraMarca = (lista, condicion) => {
  const encontrada = (lista || []).find(condicion);
  return encontrada ? encontrada.t : null;
};

const segundos = (desde, hasta) => (desde && hasta
  ? Math.round((new Date(hasta) - new Date(desde)) / 100) / 10
  : null);

// Summary of a round. A record that nobody reads is not a detection: the
// CloudTrail event and the app log are SIGNALS; only an alert that reaches
// someone (the EventBridge rule handled by the Lambda, or the CloudWatch
// alarm on the app signal) counts as DETECTION (MTTD). Containment (MTTC)
// only counts when a control, not the experiment, removed the rule.
const resumir = (ronda) => {
  const tecnicas = [];
  const mediciones = ronda.mediciones || {};

  (ronda.aperturas || []).forEach((apertura) => {
    const vigilancia = (ronda.vigilancia || {})[apertura.caso] || {};
    const alerta = (mediciones.alertas || {})[apertura.caso] || null;
    const alarma = (mediciones.alarmas_app || {})[apertura.caso] || null;
    const trail = (mediciones.cloudtrail || {})[apertura.caso] || null;
    const app = (mediciones.app || {})[apertura.caso] || null;
    const deteccion = [alerta?.t, alarma?.t].filter(Boolean).sort()[0] || null;
    const senal = [trail?.t, app?.t].filter(Boolean).sort()[0] || null;
    const contencion = vigilancia.contenida_por_control ? vigilancia.t_regla_retirada : null;

    tecnicas.push({
      caso: apertura.caso,
      attack: CASOS[apertura.caso].attack,
      t_inicio: apertura.t,
      expuesto: vigilancia.alcanzable ?? null,
      senal_registrada: Boolean(senal),
      senales: [trail && 'cloudtrail', app && 'log_app'].filter(Boolean),
      t_senal_s: segundos(apertura.t, senal),
      detectado: Boolean(deteccion),
      detectado_por: [alerta && 'eventbridge', alarma && 'alarma_app'].filter(Boolean),
      mttd_s: segundos(apertura.t, deteccion),
      contenido: Boolean(contencion),
      mttc_s: segundos(apertura.t, contencion)
    });
  });

  if (ronda.salida) {
    const bloqueada = ronda.salida.prohibido_conecta === false;
    tecnicas.push({
      caso: 'salida',
      attack: CASOS.salida.attack,
      t_inicio: ronda.salida.t,
      expuesto: ronda.salida.prohibido_conecta,
      senal_registrada: false,
      senales: [],
      t_senal_s: null,
      detectado: false,
      detectado_por: [],
      mttd_s: null,
      contenido: bloqueada,
      mttc_s: bloqueada ? 0 : null,
      nota: 'prevencion por filtrado de salida; no hay deteccion (requiere VPC Flow Logs)'
    });
  }

  const detectadas = tecnicas.filter((t) => t.detectado).length;
  const contenidas = tecnicas.filter((t) => t.contenido).length;
  const conSenal = tecnicas.filter((t) => t.senal_registrada).length;

  return {
    tecnicas,
    senal_registrada: tecnicas.length ? `${conSenal}/${tecnicas.length}` : '0/0',
    cobertura_deteccion: tecnicas.length ? `${detectadas}/${tecnicas.length}` : '0/0',
    contencion: tecnicas.length ? `${contenidas}/${tecnicas.length}` : '0/0',
    falsos_positivos: ronda.estado_estable?.alertas_sin_condicion_adversa ?? null
  };
};

module.exports = {
  MARCA,
  CASOS,
  normalizar,
  esPublica,
  esDelExperimento,
  auditar,
  permisoAdverso,
  primeraMarca,
  segundos,
  resumir
};
