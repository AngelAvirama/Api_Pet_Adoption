// Shared helpers of the security game day (defense in depth): timestamped
// log (bitacora), stop switch, agreed window, AWS CLI calls and results.
// No dependencies outside Node, same shape as the group's GCP experiments.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RESULTS_DIR = process.env.SEC_RESULTS_DIR || path.join(__dirname, 'results');
const STOP_FILE = path.join(RESULTS_DIR, 'STOP');
const REGION = process.env.AWS_REGION || 'us-east-1';
const PREFIJO = process.env.SEC_PREFIJO || 'pet-adoption-demo';
const AWS_TIMEOUT_MS = Number(process.env.SEC_AWS_TIMEOUT_MS || 60000);

const ahora = () => new Date().toISOString();

const segundosEntre = (desde, hasta) => {
  if (!desde || !hasta) {
    return null;
  }
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 100) / 10;
};

// Stop switch of the rules of engagement: while results/STOP exists no
// adverse action starts (create it with: echo > chaos/security/results/STOP)
const comprobarParada = (bitacora) => {
  if (fs.existsSync(STOP_FILE)) {
    if (bitacora) {
      bitacora.push({ t: ahora(), evento: 'parada_solicitada', detalle: STOP_FILE });
    }
    throw new Error('Interruptor de parada activado (chaos/security/results/STOP)');
  }
};

// Agreed window: CHAOS_WINDOW="<inicio ISO>/<fin ISO>". Adverse actions only
// run inside it; without a window they do not run at all.
const ventanaActiva = (ventana = process.env.CHAOS_WINDOW, momento = new Date()) => {
  if (!ventana || !ventana.includes('/')) {
    return { activa: false, motivo: 'CHAOS_WINDOW no definida (formato inicio/fin en ISO 8601)' };
  }
  const [inicio, fin] = ventana.split('/').map((v) => new Date(v.trim()));
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    return { activa: false, motivo: `CHAOS_WINDOW invalida: ${ventana}` };
  }
  const activa = momento >= inicio && momento <= fin;
  return {
    activa,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    motivo: activa ? 'dentro de la ventana acordada' : 'fuera de la ventana acordada'
  };
};

const comprobarVentana = (bitacora) => {
  const ventana = ventanaActiva();
  if (!ventana.activa) {
    if (bitacora) {
      bitacora.push({ t: ahora(), evento: 'fuera_de_ventana', detalle: ventana.motivo });
    }
    throw new Error(`Accion adversa bloqueada: ${ventana.motivo}`);
  }
  return ventana;
};

const aws = (args, { json = true, allowFail = false } = {}) => {
  const win = process.platform === 'win32';
  const full = [...args, '--region', REGION, ...(json ? ['--output', 'json'] : [])];
  const finalArgs = win ? full.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : full;
  try {
    const out = execFileSync(win ? 'aws.exe' : 'aws', finalArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      shell: win,
      // A hung CLI call must never keep a security group open: fail instead
      timeout: AWS_TIMEOUT_MS
    });
    return json ? JSON.parse(out || 'null') : out;
  } catch (error) {
    const detalle = error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM'
      ? `sin respuesta en ${AWS_TIMEOUT_MS} ms`
      : (error.stderr || error.message || '').toString().trim().split('\n').slice(-2).join(' ');
    if (allowFail) {
      return { error: detalle };
    }
    throw new Error(`aws ${args.slice(0, 2).join(' ')}: ${detalle}`);
  }
};

const archivo = (nombre) => path.join(RESULTS_DIR, nombre);

const leerResultado = (nombre) => {
  try {
    return JSON.parse(fs.readFileSync(archivo(nombre), 'utf8'));
  } catch (error) {
    return null;
  }
};

const guardarResultado = (nombre, datos) => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(archivo(nombre), `${JSON.stringify(datos, null, 2)}\n`);
  return archivo(nombre);
};

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

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  RESULTS_DIR,
  STOP_FILE,
  REGION,
  PREFIJO,
  ahora,
  segundosEntre,
  comprobarParada,
  ventanaActiva,
  comprobarVentana,
  aws,
  leerResultado,
  guardarResultado,
  parseArgs,
  esperar
};
