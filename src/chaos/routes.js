const crypto = require('crypto');
const express = require('express');
const logger = require('../config/logger');
const {
  MAX_TTL_SECONDS,
  MAX_LATENCY_MS,
  isActive,
  withRemaining,
  buildFault
} = require('./store');

const TOKEN_HEADER = 'x-chaos-token';
const MIN_TOKEN_LENGTH = 16;

const tokenMatches = (provided, expected) => {
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
};

const validateBody = (body = {}) => {
  const errors = [];
  const allowed = ['error_rate', 'latency_ms', 'ttl_seconds', 'motivo'];
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  const errorRate = body.error_rate ?? 0;
  const latencyMs = body.latency_ms ?? 0;
  const ttlSeconds = body.ttl_seconds;

  if (unknown.length > 0) {
    errors.push(`Campos no permitidos: ${unknown.join(', ')}`);
  }
  if (typeof errorRate !== 'number' || errorRate < 0 || errorRate > 1) {
    errors.push('error_rate debe ser un numero entre 0 y 1');
  }
  if (!Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > MAX_LATENCY_MS) {
    errors.push(`latency_ms debe ser un entero entre 0 y ${MAX_LATENCY_MS}`);
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL_SECONDS) {
    errors.push(`ttl_seconds es obligatorio y debe estar entre 1 y ${MAX_TTL_SECONDS}`);
  }
  if (body.motivo !== undefined && (typeof body.motivo !== 'string' || body.motivo.length > 200)) {
    errors.push('motivo debe ser texto de maximo 200 caracteres');
  }
  if (errors.length === 0 && !errorRate && !latencyMs) {
    errors.push('Indique error_rate o latency_ms mayor que cero');
  }

  return { errors, errorRate, latencyMs, ttlSeconds };
};

// The chaos switch. Three controls keep it from being used by accident or by
// strangers: it only exists when CHAOS_ENABLED=true, every call needs the
// shared token (X-Chaos-Token), and every fault has a TTL (max 15 min) after
// which it reverts on its own. /api/health is never affected, so the ALB does
// not replace the task because of an injected fault.
const createChaosRouter = ({ store, cache, env = process.env }) => {
  const router = express.Router();

  router.use((req, res, next) => {
    if (env.CHAOS_ENABLED !== 'true') {
      return res.status(404).json({ error: 'Not found', traceId: req.traceId });
    }

    const token = env.CHAOS_TOKEN || '';

    if (token.length < MIN_TOKEN_LENGTH) {
      return res.status(503).json({
        error: `CHAOS_TOKEN debe tener al menos ${MIN_TOKEN_LENGTH} caracteres`,
        traceId: req.traceId
      });
    }

    if (!tokenMatches(req.get(TOKEN_HEADER), token)) {
      logger.warn('Chaos token rejected', { evento: 'chaos_token_invalido', ip: req.ip });
      return res.status(401).json({ error: 'No autorizado', traceId: req.traceId });
    }

    return next();
  });

  router.get('/', async (req, res, next) => {
    try {
      const fault = await store.read();
      res.status(200).json(isActive(fault) ? [withRemaining(fault)] : []);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { errors, errorRate, latencyMs, ttlSeconds } = validateBody(req.body);

      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('; '), traceId: req.traceId });
      }

      const fault = await store.write(buildFault({
        errorRate,
        latencyMs,
        ttlSeconds,
        motivo: req.body.motivo || null,
        creadoPor: req.get('user-agent')?.slice(0, 100) || null
      }));
      cache.invalidate();

      logger.warn('Chaos fault activated', {
        evento: 'chaos_fault_cambiado',
        accion: 'activar',
        error_rate: errorRate,
        latency_ms: latencyMs,
        ttl_seconds: ttlSeconds,
        expires_at: fault.expires_at
      });

      return res.status(201).json(withRemaining(fault));
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/', async (req, res, next) => {
    try {
      const eliminados = await store.clear();
      cache.invalidate();

      logger.warn('Chaos fault removed', {
        evento: 'chaos_fault_cambiado',
        accion: 'revertir',
        eliminados
      });

      res.status(200).json({ eliminados });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = {
  createChaosRouter,
  tokenMatches,
  validateBody,
  TOKEN_HEADER,
  MIN_TOKEN_LENGTH
};
