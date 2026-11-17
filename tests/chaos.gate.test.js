const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { evaluate } = require('../chaos/gate');
const slo = require('../chaos/slo.json');

const k6Summary = ({ ronda = '1', rate = 0, passes = 0, fails = 400, perfil = 'completo', ok = true } = {}) => ({
  ronda,
  perfil,
  metrics: {
    'http_req_failed{scenario:carga}': { values: { rate }, thresholds: { 'rate<0.05': { ok } } },
    error_contrato: { values: { rate, passes, fails } },
    respuesta_degradada: { values: { rate: 1 } },
    duracion_contrato: { values: { 'p(95)': 12 } }
  }
});

const journal = ({ status = 'completed', deviated = false, rollback = 'succeeded' } = {}) => ({
  status,
  deviated,
  rollbacks: [{ status: rollback, activity: { name: 'revertir-el-fallo' } }]
});

describe('chaos quality gate', () => {
  test('approves a round that meets the threshold with complete evidence', () => {
    const v = evaluate({ slo, ronda: '1', k6: k6Summary(), journal: journal() });
    expect(v.aprobado).toBe(true);
    expect(v.motivos).toEqual([]);
  });

  test('rejects when the error rate breaks the threshold and the hypothesis deviated', () => {
    const v = evaluate({
      slo,
      ronda: '0',
      k6: k6Summary({ ronda: '0', rate: 1, passes: 400, fails: 0, ok: false }),
      journal: journal({ deviated: true })
    });
    expect(v.aprobado).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/Tasa de error 100.00 %/);
    expect(v.motivos.join(' ')).toMatch(/deviated/);
    expect(v.motivos.join(' ')).toMatch(/k6 rompio el umbral/);
  });

  test('rejects missing or inconsistent evidence', () => {
    expect(evaluate({ slo, ronda: '1', k6: null, journal: null }).motivos).toHaveLength(2);
    const v = evaluate({
      slo,
      ronda: '1',
      k6: k6Summary({ ronda: '0', fails: 20 }),
      journal: { status: 'aborted', deviated: false, rollbacks: [] }
    });
    expect(v.motivos.join(' ')).toMatch(/ronda 0, no de la 1/);
    expect(v.motivos.join(' ')).toMatch(/Solo 20 peticiones/);
    expect(v.motivos.join(' ')).toMatch(/estado aborted/);
    expect(v.motivos.join(' ')).toMatch(/no registra rollbacks/);
  });

  test('rejects a failed rollback and accepts the smaller sample of a smoke run', () => {
    const v = evaluate({ slo, ronda: '1', k6: k6Summary({ perfil: 'humo', fails: 20 }), journal: journal({ rollback: 'failed' }) });
    expect(v.motivos).toEqual(['Rollback revertir-el-fallo termino con estado failed']);
    expect(evaluate({ slo, ronda: '1', k6: { ronda: '1', metrics: {} }, journal: journal() }).motivos[0]).toMatch(/no trae la tasa/);
  });

  test('the CLI writes the verdict and exits 1 when rejected', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
    fs.writeFileSync(path.join(dir, 'k6-ronda-0.json'), JSON.stringify(k6Summary({ ronda: '0', rate: 1, passes: 400, fails: 0 })));
    fs.writeFileSync(path.join(dir, 'journal-ronda-0.json'), JSON.stringify(journal({ deviated: true })));
    fs.writeFileSync(path.join(dir, 'k6-ronda-1.json'), JSON.stringify(k6Summary()));
    fs.writeFileSync(path.join(dir, 'journal-ronda-1.json'), JSON.stringify(journal()));
    const gate = path.join(__dirname, '..', 'chaos', 'gate.js');

    let exitCode = 0;
    try {
      execFileSync('node', [gate, '--ronda', '0', '--dir', dir], { stdio: 'pipe' });
    } catch (error) {
      exitCode = error.status;
    }
    expect(exitCode).toBe(1);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'gate-ronda-0.json'))).aprobado).toBe(false);

    execFileSync('node', [gate, '--ronda', '1', '--dir', dir], { stdio: 'pipe' });
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'gate-ronda-1.json'))).aprobado).toBe(true);
  });
});
