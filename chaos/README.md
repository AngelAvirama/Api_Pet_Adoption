# Ingenieria del Caos (release 5): indisponibilidad de la base de datos

Experimento de Angel dentro del flujo del grupo (coordinador en GKE -> API de adopcion en AWS -> API de
vuelos en OCI). Fallo asignado: **(b) indisponibilidad de una dependencia**. La dependencia es la base
de datos (RDS PostgreSQL via Prisma) de la ruta que consume el coordinador, `GET /api/v2/animals/random`.

| Archivo | Que es |
|---|---|
| `experiments/indisponibilidad-adopcion.json` | Experimento declarativo de Chaos Toolkit: estado estable, hipotesis, metodo, radio de impacto, duracion, aborto y reversion. |
| `k6/adopcion.js` | Generador de carga con el perfil fijo (10 VU: 30 s subida, 4 min sostenido, 30 s bajada) y el escenario de guardia del radio de impacto. |
| `probes.js` | Sondas y acciones que ejecuta Chaos Toolkit (`salud`, `contrato`, `ronda`, `sin-fallos`, `activar`, `revertir`). |
| `gate.js` | Puerta de calidad: lee el resumen de k6 y el diario de Chaos Toolkit y falla si la metrica no cumple `slo.json`. |
| `slo.json` | Metrica objetivo y umbrales declarados antes de medir. |
| `mocks/fake-database.js` | Doble en memoria de Prisma para correr las rondas en local sin PostgreSQL. |
| `grafana/dashboard-caos.json` | Tablero de Grafana Cloud (Dashboards > New > Import). |
| `results/` | Resumenes de k6, diarios y veredictos de las rondas (evidencia versionada). |

El interruptor propio esta en `src/chaos/` y los patrones de resiliencia en `src/resilience/`.

## Como funciona el interruptor

- `POST /internal/chaos {"error_rate": 1, "ttl_seconds": 420}` con la cabecera `X-Chaos-Token`.
  `GET` lista el fallo activo y `DELETE` lo quita.
- Solo existe con `CHAOS_ENABLED=true`, exige un token de 16 caracteres o mas (Secrets Manager) y todo
  fallo vence a los `ttl_seconds` (maximo 900): esa es la reversion automatica.
- El estado vive en SSM Parameter Store (`/pet-adoption/demo/chaos-fault`), no en la base de datos que se
  tumba, y lo comparten los dos tasks de ECS. Cada task lo cachea 3 s; si SSM falla tres veces seguidas,
  el task asume "sin fallo" para no dejar un fallo pegado.
- El fallo solo afecta a `animal.findRandom`: lanza el mismo error que da Prisma cuando RDS no responde
  (`P1001`). `/api/health` nunca se toca, para que el ALB no reemplace los tasks por el experimento.

## Rondas

| | Ronda 0 | Ronda 1 |
|---|---|---|
| `RESILIENCE_ENABLED` | `false` | `true` |
| Comportamiento esperado | cada consulta fallida termina en 500 y se propaga al coordinador | timeout de 1 s + circuit breaker + ultimo animal conocido con `degradado: true` |
| Cabecera `X-Ronda` | `0` | `1` |

Para cambiar de ronda en AWS: workflow *Deploy Terraform and ECS* con `resilience_enabled` en `false` o `true`.

## Ejecutar una ronda contra AWS

Requisitos: Node 22+, k6 y Chaos Toolkit 1.19 (`pip install chaostoolkit==1.19.0`).

```bash
export CHAOS_BASE_URL=http://<alb> CHAOS_TOKEN=<token> RONDA=0 PYTHONUTF8=1
chaos validate chaos/experiments/indisponibilidad-adopcion.json
chaos run --rollback-strategy=always --journal-path chaos/results/journal-ronda-$RONDA.json chaos/experiments/indisponibilidad-adopcion.json
node chaos/gate.js --ronda $RONDA
```

En CI: workflow manual `chaos-gate.yml` (`ventana_autorizada=true`, `ronda`, `perfil`). Comprueba la ronda
desplegada (`X-Ronda`), ejecuta el experimento, revierte en un paso `if: always()` que falla si queda un
fallo activo, corre la puerta y sube `chaos/results/*.json` como artefacto. La ronda 0 termina en rojo a
proposito: es la evidencia de que el sistema sin protecciones no cumple.

## Ejecutar una ronda en local (sin nube ni PostgreSQL)

```bash
# terminal 1: API con la base de datos en memoria (ronda 0; para la ronda 1, RESILIENCE_ENABLED=true)
CHAOS_ENABLED=true CHAOS_TOKEN=token-local-de-desarrollo-123 RESILIENCE_ENABLED=false REDIS_ENABLED=false npm run chaos:api

# terminal 2
export CHAOS_BASE_URL=http://localhost:3000 CHAOS_TOKEN=token-local-de-desarrollo-123 RONDA=0 PERFIL=humo TTL_SECONDS=60
chaos run --rollback-strategy=always --journal-path chaos/results/journal-ronda-0.json chaos/experiments/indisponibilidad-adopcion.json
node chaos/gate.js --ronda 0
```

En PowerShell: `$env:CHAOS_ENABLED="true"` en lugar de `export`.
