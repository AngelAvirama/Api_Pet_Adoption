#!/usr/bin/env node
// Probes and actions of the experiment, run by Chaos Toolkit through the
// "process" provider (same behaviour on Windows and on the CI runner). Every
// command prints a JSON and exits 0 (tolerance met) or 1 (not met), which is
// what Chaos Toolkit evaluates.
//
//   node chaos/probes.js salud                     GET /api/health answers 200
//   node chaos/probes.js contrato [--max-ms 500]   GET /api/v2/animals/random answers 200 within max-ms
//   node chaos/probes.js ronda --esperada 0        X-Ronda of the deployment is the expected one
//   node chaos/probes.js sin-fallos                GET /internal/chaos returns an empty list
//   node chaos/probes.js activar --error 1 --ttl 420 [--latencia 0] [--motivo "..."]
//   node chaos/probes.js revertir
//
// Variables: CHAOS_BASE_URL (or BASE_URL), CHAOS_TOKEN, RONDA.
const BASE_URL = (process.env.CHAOS_BASE_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = process.env.CHAOS_TOKEN || '';

const parseArgs = (argv) => {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
};

const salida = (ok, data) => {
  console.log(JSON.stringify({ ok, ...data }, null, 2));
  process.exit(ok ? 0 : 1);
};

const pedir = async (method, path, { body, auth = false, timeoutMs = 15000, traceId } = {}) => {
  const headers = { accept: 'application/json' };
  if (auth) headers['x-chaos-token'] = TOKEN;
  if (body) headers['content-type'] = 'application/json';
  if (traceId) headers['x-trace-id'] = traceId;
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (error) {
    json = null;
  }
  return {
    status: response.status,
    ms: Date.now() - startedAt,
    json,
    traceId: response.headers.get('x-trace-id'),
    ronda: response.headers.get('x-ronda')
  };
};

const comandos = {
  async salud() {
    const r = await pedir('GET', '/api/health');
    salida(r.status === 200, { status: r.status, ms: r.ms });
  },

  async contrato(args) {
    const maxMs = Number(args['max-ms'] || 500);
    const traceId = `sonda-r${process.env.RONDA || 'x'}-${Date.now().toString(36)}`;
    const r = await pedir('GET', '/api/v2/animals/random', { timeoutMs: 30000, traceId });
    salida(r.status === 200 && r.ms <= maxMs && r.traceId === traceId, {
      status: r.status,
      ms: r.ms,
      max_ms: maxMs,
      traceId: r.traceId,
      ronda: r.ronda,
      degradado: r.json?.degradado ?? false,
      motivo: r.json?.motivo ?? null
    });
  },

  async ronda(args) {
    const esperada = String(args.esperada ?? process.env.RONDA ?? '0');
    const r = await pedir('GET', '/api/health');
    salida(r.ronda === esperada, { esperada, desplegada: r.ronda });
  },

  async 'sin-fallos'() {
    const r = await pedir('GET', '/internal/chaos', { auth: true });
    salida(r.status === 200 && Array.isArray(r.json) && r.json.length === 0, { status: r.status, activos: r.json });
  },

  async activar(args) {
    const body = {
      error_rate: Number(args.error || 0),
      latency_ms: Number(args.latencia || 0),
      ttl_seconds: Number(args.ttl || 420),
      motivo: args.motivo || `experimento ronda ${process.env.RONDA || '?'}`
    };
    const r = await pedir('POST', '/internal/chaos', { auth: true, body });
    salida(r.status === 201, { status: r.status, fallo: r.json });
  },

  async revertir() {
    const r = await pedir('DELETE', '/internal/chaos', { auth: true });
    salida(r.status === 200, { status: r.status, resultado: r.json });
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const comando = comandos[args._[0]];
  if (!comando) {
    console.error(`Comando desconocido: ${args._[0]}. Opciones: ${Object.keys(comandos).join(', ')}`);
    process.exit(2);
  }
  try {
    await comando(args);
  } catch (error) {
    salida(false, { error: error.message, base_url: BASE_URL });
  }
};

main();
