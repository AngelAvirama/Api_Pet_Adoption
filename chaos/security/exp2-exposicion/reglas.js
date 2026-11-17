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

// Summary of a round: per emulated technique, whether a control detected it
// (MTTD), whether a control contained it (MTTC) and the false positives seen
// while there was no adverse condition.
const resumir = (ronda) => {
  const tecnicas = [];

  (ronda.aperturas || []).forEach((apertura) => {
    const vigilancia = (ronda.vigilancia || {})[apertura.caso] || {};
    const alerta = (ronda.mediciones?.alertas || {})[apertura.caso] || null;
    const app = (ronda.mediciones?.app || {})[apertura.caso] || null;
    const deteccion = [alerta?.t, app?.t].filter(Boolean).sort()[0] || null;
    const contencion = vigilancia.contenida_por_control ? vigilancia.t_regla_retirada : null;

    tecnicas.push({
      caso: apertura.caso,
      attack: CASOS[apertura.caso].attack,
      t_inicio: apertura.t,
      expuesto: vigilancia.alcanzable ?? null,
      detectado: Boolean(deteccion),
      detectado_por: [alerta && 'eventbridge', app && 'app'].filter(Boolean),
      mttd_s: segundos(apertura.t, deteccion),
      contenido: Boolean(contencion),
      mttc_s: segundos(apertura.t, contencion)
    });
  });

  if (ronda.salida) {
    tecnicas.push({
      caso: 'salida',
      attack: CASOS.salida.attack,
      t_inicio: ronda.salida.t,
      expuesto: ronda.salida.prohibido_conecta,
      detectado: false,
      detectado_por: [],
      mttd_s: null,
      contenido: ronda.salida.prohibido_conecta === false,
      mttc_s: ronda.salida.prohibido_conecta === false ? 0 : null,
      nota: 'prevencion por filtrado de salida; no hay deteccion (requiere VPC Flow Logs)'
    });
  }

  const detectadas = tecnicas.filter((t) => t.detectado).length;
  const contenidas = tecnicas.filter((t) => t.contenido).length;
  const falsosPositivos = ronda.estado_estable?.alertas_sin_condicion_adversa ?? null;

  return {
    tecnicas,
    cobertura_deteccion: tecnicas.length ? `${detectadas}/${tecnicas.length}` : '0/0',
    contencion: tecnicas.length ? `${contenidas}/${tecnicas.length}` : '0/0',
    falsos_positivos: falsosPositivos
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
