const {
  chaosFaultActive,
  chaosInjectedFailuresTotal,
  degradedResponsesTotal
} = require('../config/metrics');
const {
  setChaosFaultState,
  recordChaosInjectedFailure,
  recordDegradedResponse
} = require('../config/otelMetrics');

// Same signal to Prometheus (/metrics) and to OpenTelemetry (Grafana Cloud)
const publishFaultState = (fault) => {
  chaosFaultActive.set({ dependencia: 'database', tipo: 'latencia' }, fault && fault.latency_ms > 0 ? 1 : 0);
  chaosFaultActive.set({ dependencia: 'database', tipo: 'error' }, fault && fault.error_rate > 0 ? 1 : 0);
  setChaosFaultState(fault);
};

const countInjectedFailure = (operacion) => {
  chaosInjectedFailuresTotal.inc({ dependencia: 'database', operacion });
  recordChaosInjectedFailure(operacion);
};

const countDegradedResponse = (ruta, motivo) => {
  degradedResponsesTotal.inc({ ruta, motivo });
  recordDegradedResponse(ruta, motivo);
};

module.exports = {
  publishFaultState,
  countInjectedFailure,
  countDegradedResponse
};
