require('dotenv').config();

const { NodeSDK } = require('@opentelemetry/sdk-node');

const {
  getNodeAutoInstrumentations
} = require('@opentelemetry/auto-instrumentations-node');

const {
  OTLPTraceExporter
} = require('@opentelemetry/exporter-trace-otlp-proto');

const {
  OTLPMetricExporter
} = require('@opentelemetry/exporter-metrics-otlp-proto');

const {
  OTLPLogExporter
} = require('@opentelemetry/exporter-logs-otlp-proto');

const {
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics');

const {
  BatchLogRecordProcessor
} = require('@opentelemetry/sdk-logs');

const {
  resourceFromAttributes
} = require('@opentelemetry/resources');

const os = require('os');

const resource = resourceFromAttributes({
  'service.name': process.env.OTEL_SERVICE_NAME || 'api-b-adopcion',
  'service.instance.id':
    process.env.HOSTNAME || os.hostname(),
  'deployment.environment':
    process.env.NODE_ENV || 'development'
});

const traceExporter = new OTLPTraceExporter();

const metricExporter = new OTLPMetricExporter();

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 15000
});

const logExporter = new OTLPLogExporter();

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  logRecordProcessors: [
    new BatchLogRecordProcessor({
      exporter: logExporter
    })
  ],
  instrumentations: [
    getNodeAutoInstrumentations()
  ]
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
});