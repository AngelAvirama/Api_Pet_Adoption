#!/usr/bin/env node
// Quality gate of the chaos experiment (chaos gate). It reads the k6 summary
// and the Chaos Toolkit journal of a round and fails (exit 1) when the target
// metric does not meet chaos/slo.json or when the evidence is missing or
// untrustworthy. The verdict, with every reason, is written as JSON.
//
//   node chaos/gate.js --ronda 0 [--dir chaos/results] [--out chaos/results/gate-ronda-0.json]
const fs = require('fs');
const path = require('path');

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
};

const metricValue = (summary, name, stat) => summary?.metrics?.[name]?.values?.[stat];

// Pure evaluation, easy to test: inputs in, verdict out
const evaluate = ({ slo, k6, journal, ronda }) => {
  const motivos = [];
  const medido = {};

  if (!k6) {
    motivos.push('Falta el resumen de k6 de la ronda');
  } else {
    const humo = k6.perfil === 'humo';
    const errorRate = metricValue(k6, 'http_req_failed{scenario:carga}', 'rate')
      ?? metricValue(k6, 'error_contrato', 'rate');
    const passes = metricValue(k6, 'error_contrato', 'passes') ?? 0;
    const fails = metricValue(k6, 'error_contrato', 'fails') ?? 0;
    const peticiones = passes + fails;
    const minimo = humo ? slo.peticiones_minimas_humo : slo.peticiones_minimas;

    medido.perfil = k6.perfil;
    medido.error_rate = errorRate;
    medido.peticiones = peticiones;
    medido.degradadas = metricValue(k6, 'respuesta_degradada', 'rate');
    medido.p95_ms = metricValue(k6, 'duracion_contrato', 'p(95)');

    if (String(k6.ronda) !== String(ronda)) {
      motivos.push(`El resumen de k6 es de la ronda ${k6.ronda}, no de la ${ronda}`);
    }
    if (errorRate === undefined) {
      motivos.push('El resumen de k6 no trae la tasa de error del escenario carga');
    } else if (errorRate > slo.error_rate_max) {
      motivos.push(`Tasa de error ${(errorRate * 100).toFixed(2)} % supera el umbral de ${(slo.error_rate_max * 100).toFixed(2)} %`);
    }
    if (peticiones < minimo) {
      motivos.push(`Solo ${peticiones} peticiones medidas (minimo ${minimo}): la medicion no es representativa`);
    }
    Object.entries(k6.metrics || {}).forEach(([name, metric]) => {
      Object.entries(metric.thresholds || {}).forEach(([rule, result]) => {
        if (!result.ok) {
          motivos.push(`k6 rompio el umbral ${name} ${rule}`);
        }
      });
    });
  }

  if (!journal) {
    motivos.push('Falta el diario de Chaos Toolkit de la ronda');
  } else {
    medido.experimento = journal.status;
    medido.desviado = journal.deviated;
    if (journal.status !== 'completed') {
      motivos.push(`El experimento termino con estado ${journal.status}`);
    }
    if (journal.deviated) {
      motivos.push('La hipotesis de estado estable se refuto (deviated)');
    }
    const rollbacks = journal.rollbacks || [];
    if (rollbacks.length === 0) {
      motivos.push('El diario no registra rollbacks');
    }
    rollbacks.filter((r) => r.status !== 'succeeded').forEach((r) => {
      motivos.push(`Rollback ${r.activity?.name || '?'} termino con estado ${r.status}`);
    });
  }

  return {
    ronda: String(ronda),
    aprobado: motivos.length === 0,
    umbral: { error_rate_max: slo.error_rate_max },
    medido,
    motivos,
    evaluado: new Date().toISOString()
  };
};

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const ronda = args.ronda ?? process.env.RONDA ?? '0';
  const dir = args.dir || process.env.RESULTS_DIR || 'chaos/results';
  const slo = readJson(args.slo || path.join(__dirname, 'slo.json'));
  const veredicto = evaluate({
    slo,
    ronda,
    k6: readJson(path.join(dir, `k6-ronda-${ronda}.json`)),
    journal: readJson(path.join(dir, `journal-ronda-${ronda}.json`))
  });

  const out = args.out || path.join(dir, `gate-ronda-${ronda}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(veredicto, null, 2));

  console.log(JSON.stringify(veredicto, null, 2));
  if (!veredicto.aprobado) {
    console.error(`PUERTA RECHAZADA (ronda ${ronda}):\n - ${veredicto.motivos.join('\n - ')}`);
    process.exitCode = 1;
  } else {
    console.log(`PUERTA APROBADA (ronda ${ronda})`);
  }
};

if (require.main === module) {
  main();
}

module.exports = { evaluate, readJson };
