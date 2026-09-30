export interface SystemHealthReport {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  service: string;
  version: string;
  uptimeSeconds: number;
  memoryUsageMb: number;
  nodeVersion: string;
  timestamp: string;
}

/**
 * Diagnostic Health Probe (Zero Runtime Dependencies).
 * Fornece telemetria de liveness e readiness de sub-milissegundo para esteiras e orquestradores.
 */
export function getSystemHealthReport(serviceName: string, serviceVersion: string = "1.1.0"): SystemHealthReport {
  const mem = process.memoryUsage();
  return {
    status: "HEALTHY",
    service: serviceName,
    version: serviceVersion,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };
}
