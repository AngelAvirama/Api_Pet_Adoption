process.env.REDIS_ENABLED = 'false';

const { register } = require('../src/config/metrics');
const { publishFaultState, countInjectedFailure, countDegradedResponse } = require('../src/chaos/telemetry');

const valueOf = async (name, labels) => {
  const metric = (await register.getMetricsAsJSON()).find((m) => m.name === name);
  const sample = metric.values.find((v) => Object.entries(labels).every(([k, val]) => v.labels[k] === val));
  return sample ? sample.value : 0;
};

describe('chaos telemetry', () => {
  test('marks the injection window with chaos_fault_active', async () => {
    publishFaultState({ error_rate: 1, latency_ms: 0 });
    expect(await valueOf('chaos_fault_active', { tipo: 'error' })).toBe(1);
    expect(await valueOf('chaos_fault_active', { tipo: 'latencia' })).toBe(0);

    publishFaultState(null);
    expect(await valueOf('chaos_fault_active', { tipo: 'error' })).toBe(0);
  });

  test('counts injected failures and degraded responses', async () => {
    countInjectedFailure('animal.findRandom');
    countDegradedResponse('/api/v2/animals/random', 'circuito_abierto');

    expect(await valueOf('chaos_injected_failures_total', { operacion: 'animal.findRandom' })).toBe(1);
    expect(await valueOf('degraded_responses_total', { motivo: 'circuito_abierto' })).toBe(1);
  });
});
