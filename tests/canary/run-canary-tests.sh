#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOCK="$ROOT/tests/canary/mock-bin"

export PATH="$MOCK:$PATH"

GATE="$ROOT/scripts/canary-quality-gate.ps1"
ROLLBACK="$ROOT/scripts/canary-rollback.ps1"

PASS=0
FAIL=0

run_gate_test() {
    local scenario="$1"
    local expected="$2"

    echo
    echo "======================================"
    echo "Escenario: $scenario"
    echo "======================================"

    export CANARY_TEST_CASE="$scenario"

    pwsh -NoLogo -NoProfile -File "$GATE" \
        -WindowMinutes 5 \
        -MinRequests 20 \
        -Max5xxRate 1.0 \
        -MaxP95Seconds 1.0

    actual=$?

    if [[ "$actual" -eq "$expected" ]]; then
        echo "PASS: codigo $actual"
        PASS=$((PASS + 1))
    else
        echo "FAIL: esperado $expected, recibido $actual"
        FAIL=$((FAIL + 1))
    fi
}

chmod +x "$MOCK/aws"


run_gate_test promote 0
run_gate_test hold 1
run_gate_test rollback 2

echo
echo "======================================"
echo "Prueba de configuracion de rollback"
echo "======================================"

export CANARY_TEST_CASE="promote"

pwsh -NoLogo -NoProfile -File "$ROLLBACK" -DryRun
rollback_result=$?

if [[ "$rollback_result" -eq 0 ]]; then
    echo "PASS: rollback DryRun"
    PASS=$((PASS + 1))
else
    echo "FAIL: rollback DryRun"
    FAIL=$((FAIL + 1))
fi

echo
echo "======================================"
echo "RESULTADOS"
echo "======================================"
echo "Aprobadas: $PASS"
echo "Fallidas: $FAIL"

if [[ "$FAIL" -gt 0 ]]; then
    exit 1
fi

exit 0
