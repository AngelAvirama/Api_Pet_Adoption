const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.SEC_RESULTS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-'));
const comun = require('../chaos/security/comun');

describe('security game day helpers', () => {
  test('the window only allows actions between its start and end', () => {
    const ventana = '2026-11-16T21:00:00-05:00/2026-11-18T12:00:00-05:00';
    expect(comun.ventanaActiva(ventana, new Date('2026-11-17T10:00:00-05:00')).activa).toBe(true);
    expect(comun.ventanaActiva(ventana, new Date('2026-11-18T13:00:00-05:00')).activa).toBe(false);
    expect(comun.ventanaActiva(undefined).activa).toBe(false);
    expect(comun.ventanaActiva('no/fecha').motivo).toMatch(/invalida/);
  });

  test('adverse actions are blocked outside the window', () => {
    const previous = process.env.CHAOS_WINDOW;
    delete process.env.CHAOS_WINDOW;
    const bitacora = [];
    expect(() => comun.comprobarVentana(bitacora)).toThrow(/bloqueada/);
    expect(bitacora[0].evento).toBe('fuera_de_ventana');
    process.env.CHAOS_WINDOW = `${new Date(Date.now() - 60000).toISOString()}/${new Date(Date.now() + 60000).toISOString()}`;
    expect(comun.comprobarVentana().activa).toBe(true);
    process.env.CHAOS_WINDOW = previous;
  });

  test('the STOP file stops every adverse action', () => {
    const bitacora = [];
    comun.comprobarParada(bitacora);
    fs.writeFileSync(comun.STOP_FILE, '');
    expect(() => comun.comprobarParada(bitacora)).toThrow(/parada/);
    expect(bitacora[0].evento).toBe('parada_solicitada');
    fs.unlinkSync(comun.STOP_FILE);
  });

  test('results are written and read back, and times are measured in seconds', () => {
    comun.guardarResultado('x.json', { a: 1 });
    expect(comun.leerResultado('x.json')).toEqual({ a: 1 });
    expect(comun.leerResultado('no-existe.json')).toBeNull();
    expect(comun.segundosEntre('2026-11-16T10:00:00Z', '2026-11-16T10:01:30.25Z')).toBe(90.3);
    expect(comun.segundosEntre(null, '2026-11-16T10:00:00Z')).toBeNull();
    expect(comun.parseArgs(['probar', '--caso', 'ecs'])).toEqual({ _: ['probar'], caso: 'ecs' });
  });

  test('aws reports a readable error when the CLI fails', () => {
    expect(comun.aws(['no-existe'], { allowFail: true }).error).toBeDefined();
    expect(() => comun.aws(['no-existe'])).toThrow(/aws no-existe/);
  });
});
