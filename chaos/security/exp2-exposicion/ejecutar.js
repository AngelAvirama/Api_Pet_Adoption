#!/usr/bin/env node
// Experiment 2 of the security game day: exposure and segmentation (network
// layer, AWS). An undeclared route appears (a security group rule open to the
// Internet) and the experiment measures whether the controls DETECT it (MTTD)
// and CONTAIN it (MTTC). Every adverse action checks the stop switch and the
// agreed window first, and is tagged "chaos-exp2" so the rollback finds it.
//
//   RONDA=0 node chaos/security/exp2-exposicion/ejecutar.js estado-estable
//   RONDA=0 node chaos/security/exp2-exposicion/ejecutar.js abrir --caso ecs
//   RONDA=0 node chaos/security/exp2-exposicion/ejecutar.js vigilar --caso ecs --max 300
//   RONDA=0 node chaos/security/exp2-exposicion/ejecutar.js salida
//   RONDA=0 node chaos/security/exp2-exposicion/ejecutar.js medir
//   RONDA=0 node chaos/security/exp2-exposicion/ejecutar.js revertir
//   RONDA=0 node chaos/security/exp2-exposicion/ejecutar.js informe
//
// Variables: RONDA, CHAOS_WINDOW (inicio/fin ISO), AWS_REGION, SEC_PREFIJO,
// SEC_RESULTS_DIR.
const comun = require('../comun');
const reglas = require('./reglas');

const RONDA = process.env.RONDA || '0';
const P = comun.PREFIJO;
const NOMBRES = { alb: `${P}-alb-sg`, ecs: `${P}-ecs-sg`, rds: `${P}-rds-sg` };
const CLUSTER = `${P}-cluster`;
const SERVICIO = `${P}-api`;
const LOG_ALERTAS = `/aws/lambda/${P}-revocar-ingreso-publico`;
const LOG_APP = `/ecs/${P}`;
const ALARMA_APP = `${P}-seguridad-acceso-directo-sin-alb`;
const ARCHIVO = `exp2-ronda-${RONDA}.json`;

const cargar = () => comun.leerResultado(ARCHIVO) || { experimento: 2, ronda: RONDA, bitacora: [] };
const guardar = (datos) => comun.guardarResultado(ARCHIVO, datos);
const anotar = (datos, evento, extra = {}) => {
  // The time of the log entry is always "now", even if the data carries
  // another t (for example the start of the egress probe)
  const entrada = { ...extra, t: comun.ahora(), evento };
  datos.bitacora.push(entrada);
  console.log(JSON.stringify(entrada));
  return entrada;
};

const idsDeGrupos = () => {
  const r = comun.aws(['ec2', 'describe-security-groups', '--filters', `Name=group-name,Values=${Object.values(NOMBRES).join(',')}`]);
  const ids = {};
  r.SecurityGroups.forEach((g) => {
    const clave = Object.keys(NOMBRES).find((k) => NOMBRES[k] === g.GroupName);
    ids[clave] = g.GroupId;
  });
  return ids;
};

const reglasDe = (ids) => comun.aws([
  'ec2', 'describe-security-group-rules', '--filters', `Name=group-id,Values=${Object.values(ids).join(',')}`
]).SecurityGroupRules.map(reglas.normalizar);

const ipsPublicasDeTasks = () => {
  const lista = comun.aws(['ecs', 'list-tasks', '--cluster', CLUSTER, '--service-name', SERVICIO, '--desired-status', 'RUNNING']);
  if (!lista.taskArns.length) return [];
  const tareas = comun.aws(['ecs', 'describe-tasks', '--cluster', CLUSTER, '--tasks', ...lista.taskArns]);
  const enis = tareas.tasks.flatMap((t) => t.attachments.flatMap((a) => a.details))
    .filter((d) => d.name === 'networkInterfaceId').map((d) => d.value);
  if (!enis.length) return [];
  const interfaces = comun.aws(['ec2', 'describe-network-interfaces', '--network-interface-ids', ...enis]);
  return interfaces.NetworkInterfaces.map((n) => n.Association?.PublicIp).filter(Boolean);
};

// Direct HTTP call to a task, skipping the ALB, from this machine (an origin
// that the architecture never declared). Sends a trace id so the app log of
// the access can be correlated.
const accesoDirecto = async (ip, caso) => {
  const traceId = `exp2-r${RONDA}-${caso}-${Date.now().toString(36)}`;
  try {
    const res = await fetch(`http://${ip}:3000/api/v2/animals/random`, {
      headers: { 'x-trace-id': traceId, 'user-agent': 'exp2-sonda-externa', connection: 'close' },
      signal: AbortSignal.timeout(5000)
    });
    // Read the body inside the same timeout: an unread body keeps the socket
    // busy and, probe after probe, can leave the loop waiting forever
    await res.arrayBuffer();
    return { ip, traceId, alcanzable: true, status: res.status };
  } catch (error) {
    return { ip, traceId, alcanzable: false, error: error.name };
  }
};

const reglaExiste = (id) => {
  const r = comun.aws(['ec2', 'describe-security-group-rules', '--security-group-rule-ids', id], { allowFail: true });
  return Boolean(r && !r.error && r.SecurityGroupRules && r.SecurityGroupRules.length);
};

const eventosDeLog = (grupo, desdeIso, patron) => {
  const r = comun.aws([
    'logs', 'filter-log-events', '--log-group-name', grupo,
    '--start-time', String(new Date(desdeIso).getTime() - 60000),
    ...(patron ? ['--filter-pattern', patron] : [])
  ], { allowFail: true });
  return r && !r.error ? r.events || [] : [];
};

const comandos = {
  async 'estado-estable'() {
    const datos = cargar();
    const ids = idsDeGrupos();
    const todas = reglasDe(ids);
    const auditoria = reglas.auditar(todas, ids);
    const ips = ipsPublicasDeTasks();
    const directo = await Promise.all(ips.map((ip) => accesoDirecto(ip, 'estable')));
    const trails = comun.aws(['cloudtrail', 'describe-trails'], { allowFail: true });
    const reglaAlerta = comun.aws(['events', 'describe-rule', '--name', `${P}-seguridad-sg-publico`], { allowFail: true });
    const remediacion = comun.aws(['lambda', 'get-function', '--function-name', `${P}-revocar-ingreso-publico`], { allowFail: true });
    const alarma = comun.aws(['cloudwatch', 'describe-alarms', '--alarm-names', ALARMA_APP], { allowFail: true });
    const unaHoraAtras = new Date(Date.now() - 3600 * 1000).toISOString();
    const alertasPrevias = eventosDeLog(LOG_ALERTAS, unaHoraAtras, '"exposicion_detectada"');

    datos.estado_estable = {
      t: comun.ahora(),
      ventana: comun.ventanaActiva(),
      grupos: ids,
      reglas: todas,
      auditoria,
      tasks_con_ip_publica: ips.length,
      acceso_directo_bloqueado: directo.every((d) => !d.alcanzable),
      acceso_directo: directo,
      cobertura: {
        cloudtrail_trail: Boolean(trails && !trails.error && trails.trailList && trails.trailList.length),
        alerta_eventbridge: Boolean(reglaAlerta && !reglaAlerta.error && reglaAlerta.State === 'ENABLED'),
        remediacion_lambda: Boolean(remediacion && !remediacion.error),
        alarma_senal_app: Boolean(alarma && !alarma.error && alarma.MetricAlarms && alarma.MetricAlarms.length),
        senal_app_acceso_directo: true
      },
      alertas_sin_condicion_adversa: alertasPrevias.length
    };
    anotar(datos, 'estado_estable', {
      inesperadas: auditoria.inesperadas.length,
      salida_sin_filtrar: auditoria.salida_sin_filtrar,
      cobertura: datos.estado_estable.cobertura
    });
    guardar(datos);
  },

  async abrir(args) {
    const datos = cargar();
    comun.comprobarParada(datos.bitacora);
    comun.comprobarVentana(datos.bitacora);
    const caso = args.caso || 'ecs';
    const ids = idsDeGrupos();
    const permiso = reglas.permisoAdverso(caso, RONDA);
    const inicio = anotar(datos, 'condicion_adversa_inicio', { caso, grupo: ids[reglas.CASOS[caso].grupo], attack: reglas.CASOS[caso].attack });
    const r = comun.aws([
      'ec2', 'authorize-security-group-ingress', '--group-id', ids[reglas.CASOS[caso].grupo],
      '--ip-permissions', JSON.stringify(permiso)
    ]);
    const id = r.SecurityGroupRules?.[0]?.SecurityGroupRuleId;
    datos.aperturas = (datos.aperturas || []).filter((a) => a.caso !== caso);
    datos.aperturas.push({ caso, t: inicio.t, regla: id, grupo: ids[reglas.CASOS[caso].grupo] });
    anotar(datos, 'regla_permisiva_creada', { caso, regla: id });
    guardar(datos);
  },

  // Polls every 10 s: is the rule still there, and can the task be reached
  // from outside? Stops when a control removed the rule or after --max s.
  async vigilar(args) {
    const datos = cargar();
    const caso = args.caso || 'ecs';
    const apertura = (datos.aperturas || []).find((a) => a.caso === caso);
    if (!apertura) throw new Error(`No hay apertura registrada para ${caso}`);
    const maximo = Number(args.max || 300) * 1000;
    const muestras = [];
    const ips = caso === 'ecs' ? ipsPublicasDeTasks() : [];
    const fin = Date.now() + maximo;

    while (Date.now() < fin) {
      comun.comprobarParada(datos.bitacora);
      const existe = reglaExiste(apertura.regla);
      const accesos = await Promise.all(ips.map((ip) => accesoDirecto(ip, caso)));
      const muestra = { t: comun.ahora(), regla_presente: existe, alcanzable: accesos.some((a) => a.alcanzable), accesos };
      muestras.push(muestra);
      console.log(JSON.stringify({ t: muestra.t, caso, regla_presente: existe, alcanzable: muestra.alcanzable }));
      if (!existe) break;
      await comun.esperar(10000);
    }

    const retirada = reglas.primeraMarca(muestras, (m) => !m.regla_presente);
    datos.vigilancia = datos.vigilancia || {};
    datos.vigilancia[caso] = {
      desde: apertura.t,
      alcanzable: muestras.some((m) => m.alcanzable),
      t_regla_retirada: retirada,
      contenida_por_control: Boolean(retirada),
      muestras
    };
    anotar(datos, retirada ? 'contenida_por_control' : 'no_contenida_en_la_ventana', { caso, t_regla_retirada: retirada });
    guardar(datos);
  },

  // Egress probe: a one-off task with the same network as the service tries
  // a forbidden destination (TCP 80 on the Internet) and an allowed one (TCP
  // 443 to AWS). Exit code = 1 if the forbidden one connected + 2 if the
  // allowed one connected.
  async salida() {
    const datos = cargar();
    comun.comprobarParada(datos.bitacora);
    comun.comprobarVentana(datos.bitacora);
    const servicio = comun.aws(['ecs', 'describe-services', '--cluster', CLUSTER, '--services', SERVICIO]).services[0];
    const red = servicio.networkConfiguration.awsvpcConfiguration;
    const codigo = [
      "const net=require('net');",
      "const t=(h,p)=>new Promise(r=>{const s=net.connect({host:h,port:p,timeout:5000});",
      "s.on('connect',()=>{s.destroy();r(true)});s.on('timeout',()=>{s.destroy();r(false)});s.on('error',()=>r(false))});",
      "Promise.all([t('example.com',80),t('sts.us-east-1.amazonaws.com',443)])",
      ".then(([p,a])=>{console.log(JSON.stringify({prohibido:p,permitido:a}));process.exit((p?1:0)+(a?2:0))});"
    ].join('');
    const overrides = { containerOverrides: [{ name: 'api', command: ['node', '-e', codigo] }] };
    const netConfig = `awsvpcConfiguration={subnets=[${red.subnets.join(',')}],securityGroups=[${red.securityGroups.join(',')}],assignPublicIp=${red.assignPublicIp}}`;
    const inicio = anotar(datos, 'prueba_salida_inicio', { attack: reglas.CASOS.salida.attack });
    const tarea = comun.aws([
      'ecs', 'run-task', '--cluster', CLUSTER, '--task-definition', servicio.taskDefinition,
      '--launch-type', 'FARGATE', '--network-configuration', netConfig, '--overrides', JSON.stringify(overrides)
    ]).tasks[0].taskArn;
    comun.aws(['ecs', 'wait', 'tasks-stopped', '--cluster', CLUSTER, '--tasks', tarea], { json: false });
    const detalle = comun.aws(['ecs', 'describe-tasks', '--cluster', CLUSTER, '--tasks', tarea]).tasks[0];
    const exit = detalle.containers.find((c) => c.name === 'api').exitCode;

    datos.salida = {
      t: inicio.t,
      tarea,
      exit_code: exit,
      prohibido_conecta: exit === undefined ? null : Boolean(exit & 1),
      permitido_conecta: exit === undefined ? null : Boolean(exit & 2)
    };
    anotar(datos, 'prueba_salida_fin', datos.salida);
    guardar(datos);
  },

  // Evidence after the fact: the CloudTrail record (the signal exists), the
  // alert delivered by EventBridge (detection, ingestion time = MTTD) and the
  // app log of the direct access (second layer, correlated by trace id).
  async medir() {
    const datos = cargar();
    datos.mediciones = { t: comun.ahora(), cloudtrail: {}, alertas: {}, app: {}, alarmas_app: {} };

    (datos.aperturas || []).forEach((apertura) => {
      const ct = comun.aws([
        'cloudtrail', 'lookup-events', '--lookup-attributes', 'AttributeKey=EventName,AttributeValue=AuthorizeSecurityGroupIngress',
        '--start-time', new Date(new Date(apertura.t).getTime() - 60000).toISOString()
      ], { allowFail: true });
      const evento = (ct.Events || []).find((e) => (e.CloudTrailEvent || '').includes(apertura.grupo));
      datos.mediciones.cloudtrail[apertura.caso] = evento ? { t: new Date(typeof evento.EventTime === 'number' ? evento.EventTime * 1000 : evento.EventTime).toISOString(), evento: evento.EventId } : null;

      const alertas = eventosDeLog(LOG_ALERTAS, apertura.t, '"exposicion_detectada"').filter((e) => e.message.includes(apertura.grupo));
      const primera = alertas.sort((a, b) => a.ingestionTime - b.ingestionTime)[0];
      datos.mediciones.alertas[apertura.caso] = primera ? { t: new Date(primera.ingestionTime).toISOString(), total: alertas.length } : null;

      if (apertura.caso === 'ecs') {
        const app = eventosDeLog(LOG_APP, apertura.t, '"acceso_directo_sin_alb"')
          .filter((e) => e.message.includes(`exp2-r${RONDA}-`));
        const primeraApp = app.sort((a, b) => a.ingestionTime - b.ingestionTime)[0];
        // Alert on the app signal: first transition of the CloudWatch alarm to
        // ALARM after the rule was opened
        const historia = comun.aws([
          'cloudwatch', 'describe-alarm-history', '--alarm-name', ALARMA_APP, '--history-item-type', 'StateUpdate',
          '--start-date', new Date(new Date(apertura.t).getTime() - 60000).toISOString()
        ], { allowFail: true });
        const aAlarma = ((historia && historia.AlarmHistoryItems) || [])
          .filter((h) => /to ALARM/.test(h.HistorySummary || ''))
          .map((h) => new Date(h.Timestamp).toISOString())
          .filter((t) => t >= apertura.t)
          .sort()[0];
        datos.mediciones.alarmas_app.ecs = aAlarma ? { t: aAlarma } : null;

        datos.mediciones.app.ecs = primeraApp ? {
          t: new Date(primeraApp.ingestionTime).toISOString(),
          total: app.length,
          ejemplo: primeraApp.message.slice(0, 600)
        } : null;
      }
    });

    anotar(datos, 'medicion', { alertas: datos.mediciones.alertas, alarmas_app: datos.mediciones.alarmas_app, senal_app: Boolean(datos.mediciones.app.ecs) });
    guardar(datos);
  },

  // Rollback: removes every rule tagged chaos-exp2 and checks that the
  // groups are back to the declared state and the tasks are not reachable.
  async revertir() {
    const datos = cargar();
    const ids = idsDeGrupos();
    const marcadas = reglasDe(ids).filter((r) => reglas.esDelExperimento(r));
    marcadas.forEach((r) => {
      comun.aws(['ec2', 'revoke-security-group-ingress', '--group-id', r.grupo, '--security-group-rule-ids', r.id], { allowFail: true });
    });
    const restantes = reglasDe(ids).filter((r) => reglas.esDelExperimento(r));
    const ips = ipsPublicasDeTasks();
    const directo = await Promise.all(ips.map((ip) => accesoDirecto(ip, 'reversion')));
    datos.reversion = {
      t: comun.ahora(),
      retiradas_por_el_experimento: marcadas.map((r) => r.id),
      restantes: restantes.map((r) => r.id),
      acceso_directo_bloqueado: directo.every((d) => !d.alcanzable),
      verificada: restantes.length === 0 && directo.every((d) => !d.alcanzable)
    };
    anotar(datos, 'reversion', datos.reversion);
    guardar(datos);
    if (!datos.reversion.verificada) process.exitCode = 1;
  },

  async informe() {
    const datos = cargar();
    datos.resumen = reglas.resumir(datos);
    guardar(datos);
    console.log(JSON.stringify(datos.resumen, null, 2));
  }
};

const main = async () => {
  const args = comun.parseArgs(process.argv.slice(2));
  const comando = comandos[args._[0]];
  if (!comando) {
    console.error(`Comando: ${Object.keys(comandos).join(', ')}`);
    process.exit(2);
  }
  try {
    await comando(args);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { comandos };
