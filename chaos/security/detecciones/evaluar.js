#!/usr/bin/env node
// Detection as code: every rule in chaos/security/detecciones/*.json carries
// the EventBridge pattern published by Terraform and the decision function of
// the Lambda, plus positive and negative cases. This script proves that each
// rule fires on the adverse condition and stays silent on normal traffic.
//
//   node chaos/security/detecciones/evaluar.js
const fs = require('fs');
const path = require('path');
const { decidir } = require('../../../security/lambda/revocar-ingreso-publico/decidir');

// Subset of the EventBridge pattern language used by the rules: arrays of
// exact values, {"exists": bool} and nested objects. An array in the event
// matches when any of its values matches.
const coincide = (patron, evento) => Object.entries(patron).every(([clave, esperado]) => {
  const valor = evento ? evento[clave] : undefined;
  if (Array.isArray(esperado)) {
    return esperado.some((e) => {
      if (e && typeof e === 'object' && 'exists' in e) return e.exists === (valor !== undefined);
      return Array.isArray(valor) ? valor.includes(e) : valor === e;
    });
  }
  if (esperado && typeof esperado === 'object') return coincide(esperado, valor);
  return valor === esperado;
});

// Subset of the CloudWatch Logs JSON filter pattern language used by the
// rules: { $.campo = "valor" } and { $.campo != "valor" }, joined with &&.
const compilarFiltroCloudWatch = (filtro) => {
  const cuerpo = filtro.trim().replace(/^\{/, '').replace(/\}$/, '');
  const condiciones = cuerpo.split('&&').map((parte) => {
    const m = /^\s*\$\.([A-Za-z0-9_.]+)\s*(=|!=)\s*"([^"]*)"\s*$/.exec(parte);
    if (!m) throw new Error(`Filtro de CloudWatch no soportado: ${parte}`);
    const [, ruta, op, valor] = m;
    return (entrada) => {
      const actual = ruta.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), entrada);
      return op === '=' ? actual === valor : actual !== valor;
    };
  });
  return (entrada) => condiciones.every((c) => c(entrada));
};

const evaluarRegla = (regla) => {
  const dispara = regla.filtro_cloudwatch
    ? compilarFiltroCloudWatch(regla.filtro_cloudwatch)
    : (entrada) => coincide(regla.patron_eventbridge, entrada)
      && decidir(entrada, regla.grupos_protegidos).exposicion;
  const positivos = regla.casos.positivos.map((c) => ({ nombre: c.nombre, dispara: dispara(c.entrada) }));
  const negativos = regla.casos.negativos.map((c) => ({ nombre: c.nombre, dispara: dispara(c.entrada) }));
  return {
    id: regla.id,
    positivos,
    negativos,
    ok: positivos.every((c) => c.dispara) && negativos.every((c) => !c.dispara)
  };
};

const cargarReglas = (dir = __dirname) => fs.readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

if (require.main === module) {
  const resultados = cargarReglas().map(evaluarRegla);
  resultados.forEach((r) => {
    console.log(`${r.ok ? 'OK   ' : 'FALLA'} ${r.id}`);
    r.positivos.forEach((c) => console.log(`   ${c.dispara ? 'dispara' : 'NO dispara'} (positivo) ${c.nombre}`));
    r.negativos.forEach((c) => console.log(`   ${c.dispara ? 'DISPARA' : 'calla'} (negativo) ${c.nombre}`));
  });
  if (!resultados.every((r) => r.ok)) process.exitCode = 1;
}

module.exports = { coincide, compilarFiltroCloudWatch, evaluarRegla, cargarReglas };
