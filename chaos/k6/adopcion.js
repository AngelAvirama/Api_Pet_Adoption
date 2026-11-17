// Load generator of the experiment (k6). The profile is fixed and declared:
// both rounds are measured with exactly this load, changing only
// RESILIENCE_ENABLED in the deployment.
//
//   k6 run chaos/k6/adopcion.js -e BASE_URL=http://<alb> -e RONDA=0
//   k6 run chaos/k6/adopcion.js -e BASE_URL=http://localhost:3000 -e RONDA=1 -e PERFIL=humo
//
// Variables: BASE_URL, RONDA (0|1), PERFIL (completo|humo),
// ERROR_RATE_MAX (target threshold, 0.05), RESULTS_DIR.
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const RONDA = __ENV.RONDA || '0';
const PERFIL = __ENV.PERFIL || 'completo';
const ERROR_RATE_MAX = Number(__ENV.ERROR_RATE_MAX || 0.05);
const RESULTS_DIR = (__ENV.RESULTS_DIR || 'chaos/results').replace(/\/$/, '');

// Declared profile: 10 virtual users in a closed loop, 30 s ramp up, 4 min
// sustained, 30 s ramp down (5 min in total). "humo" is a 15 s version to
// validate the setup, never to measure.
const PERFILES = {
  completo: [
    { duration: '30s', target: 10 },
    { duration: '4m', target: 10 },
    { duration: '30s', target: 0 }
  ],
  humo: [
    { duration: '5s', target: 3 },
    { duration: '5s', target: 3 },
    { duration: '5s', target: 0 }
  ]
};

const etapas = PERFILES[PERFIL] || PERFILES.completo;
const duracionGuardia = PERFIL === 'humo' ? '15s' : '5m';

export const respuestaDegradada = new Rate('respuesta_degradada');
export const errorDelContrato = new Rate('error_contrato');
export const duracionContrato = new Trend('duracion_contrato', true);

export const options = {
  scenarios: {
    // The load that is measured: the route the coordinator consumes
    carga: {
      executor: 'ramping-vus',
      exec: 'contrato',
      startVUs: 0,
      stages: etapas,
      gracefulRampDown: '10s'
    },
    // Guard of the blast radius: /api/health is outside the injected fault.
    // If it starts failing, the experiment is hurting more than declared.
    guardia: {
      executor: 'constant-arrival-rate',
      exec: 'guardia',
      rate: 1,
      timeUnit: '1s',
      duration: duracionGuardia,
      preAllocatedVUs: 2
    }
  },
  thresholds: {
    // Target metric: error rate of GET /api/v2/animals/random
    'http_req_failed{scenario:carga}': [`rate<${ERROR_RATE_MAX}`],
    // Abort condition: the part of the API outside the blast radius fails
    // in more than half of its checks for 60 s -> stop the load at once.
    'http_req_failed{scenario:guardia}': [
      { threshold: 'rate<0.5', abortOnFail: true, delayAbortEval: '60s' }
    ]
  },
  tags: { ronda: RONDA, perfil: PERFIL },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  userAgent: 'k6-pet-adoption-chaos/5.0.0'
};

export function contrato() {
  const traceId = `k6-r${RONDA}-${__VU}-${__ITER}-${Date.now().toString(36)}`;
  const res = http.get(`${BASE_URL}/api/v2/animals/random`, {
    headers: { 'X-Trace-Id': traceId, Accept: 'application/json' },
    tags: { name: 'animals_random' },
    timeout: '10s'
  });

  let body = null;
  try {
    body = res.json();
  } catch (error) {
    body = null;
  }

  check(res, {
    'estado 200': (r) => r.status === 200,
    'trace id devuelto': (r) => r.headers['X-Trace-Id'] === traceId,
    'animal en el cuerpo': () => Boolean(body && body.data && body.data.id !== undefined)
  });

  errorDelContrato.add(res.status >= 500 || res.status === 0);
  respuestaDegradada.add(Boolean(body && body.degradado === true));
  duracionContrato.add(res.timings.duration);
}

export function guardia() {
  const res = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' }, timeout: '5s' });
  check(res, { 'health 200': (r) => r.status === 200 });
}

// Short text summary without remote imports (jslib), so the script also
// runs where the network only reaches the system under test
function resumen(data) {
  const m = data.metrics;
  const rate = (name) => (m[name] ? `${(m[name].values.rate * 100).toFixed(2)} %` : 'n/a');
  const ms = (name, stat) => (m[name] ? `${m[name].values[stat].toFixed(1)} ms` : 'n/a');
  const thresholds = Object.entries(m)
    .filter(([, metric]) => metric.thresholds)
    .flatMap(([name, metric]) => Object.entries(metric.thresholds)
      .map(([rule, result]) => `   ${result.ok ? 'OK   ' : 'FALLA'} ${name} ${rule}`));

  return [
    '',
    `Ronda ${RONDA} (${PERFIL}) contra ${BASE_URL}`,
    `   peticiones al contrato : ${m.error_contrato ? m.error_contrato.values.passes + m.error_contrato.values.fails : 0}`,
    `   tasa de error (5xx)    : ${rate('error_contrato')}   <- metrica objetivo`,
    `   respuestas degradadas  : ${rate('respuesta_degradada')}`,
    `   p95 del contrato       : ${ms('duracion_contrato', 'p(95)')}`,
    `   checks                 : ${rate('checks')}`,
    'Umbrales:',
    ...thresholds,
    ''
  ].join('\n');
}

// One JSON per round, read by chaos/gate.js, plus a text summary
export function handleSummary(data) {
  const out = {};
  out[`${RESULTS_DIR}/k6-ronda-${RONDA}.json`] = JSON.stringify({
    ronda: RONDA,
    perfil: PERFIL,
    base_url: BASE_URL,
    umbrales: { error_rate_max: ERROR_RATE_MAX },
    generado: new Date().toISOString(),
    ...data
  }, null, 2);
  out.stdout = resumen(data);
  return out;
}
