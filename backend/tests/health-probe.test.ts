import test from "node:test";
import assert from "node:assert/strict";
import { getSystemHealthReport } from "./../src/telemetry/health-probe.ts";

test("System Diagnostic Health Probe: Deve reportar status HEALTHY e telemetria válida de memória e uptime", () => {
  const report = getSystemHealthReport("test-service", "1.1.0");

  assert.strictEqual(report.status, "HEALTHY", "Status inicial deve ser HEALTHY");
  assert.strictEqual(report.service, "test-service");
  assert.strictEqual(report.version, "1.1.0");
  assert.ok(report.uptimeSeconds >= 0, "Uptime deve ser maior ou igual a zero");
  assert.ok(report.memoryUsageMb > 0, "Consumo de heap deve ser maior que zero");
  assert.ok(report.nodeVersion.startsWith("v"), "Node version deve iniciar com v");
  assert.ok(!isNaN(Date.parse(report.timestamp)), "Timestamp ISO 8601 deve ser válido");
});
