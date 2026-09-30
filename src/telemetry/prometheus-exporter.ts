// =========================================================================
// Native Prometheus Exposition Exporter (/metrics)
// Service: cloudpulse-multi-tenant-analytics
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

export class PrometheusMetricsRegistry {
  private counters: Map<string, { value: number; help: string }> = new Map();
  private gauges: Map<string, { value: number; help: string }> = new Map();
  private latencySamples: number[] = [];

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.setGauge("system_uptime_seconds", 0, "Tempo de atividade do processo em segundos");
    this.setGauge("system_heap_memory_bytes", 0, "Memória heap utilizada em bytes");
    this.incrementCounter("http_requests_total", 0, "Total de requisições HTTP processadas");
  }

  public incrementCounter(name: string, count: number = 1, help: string = ""): void {
    const existing = this.counters.get(name) || { value: 0, help: help || name };
    existing.value += count;
    this.counters.set(name, existing);
  }

  public setGauge(name: string, value: number, help: string = ""): void {
    this.gauges.set(name, { value, help: help || name });
  }

  public recordLatency(durationMs: number): void {
    this.latencySamples.push(durationMs);
    if (this.latencySamples.length > 500) {
      this.latencySamples.shift();
    }
  }

  public getPercentiles(): { p50: number; p95: number; p99: number } {
    if (this.latencySamples.length === 0) return { p50: 0, p95: 0, p99: 0 };
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    return { p50, p95, p99 };
  }

  public exportMetricsString(): string {
    // Atualiza gauges de sistema em tempo real
    this.setGauge("system_uptime_seconds", Math.floor(process.uptime()));
    this.setGauge("system_heap_memory_bytes", process.memoryUsage().heapUsed);

    const lines: string[] = [];

    // Exporta Contadores
    for (const [name, meta] of this.counters.entries()) {
      if (meta.help) lines.push(`# HELP ${name} ${meta.help}`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}{service="cloudpulse-multi-tenant-analytics"} ${meta.value}`);
    }

    // Exporta Gauges
    for (const [name, meta] of this.gauges.entries()) {
      if (meta.help) lines.push(`# HELP ${name} ${meta.help}`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}{service="cloudpulse-multi-tenant-analytics"} ${meta.value}`);
    }

    // Exporta Latência p50/p95/p99
    const { p50, p95, p99 } = this.getPercentiles();
    lines.push(`# HELP http_request_duration_ms Latência em milissegundos`);
    lines.push(`# TYPE http_request_duration_ms summary`);
    lines.push(`http_request_duration_ms{service="cloudpulse-multi-tenant-analytics",quantile="0.5"} ${p50}`);
    lines.push(`http_request_duration_ms{service="cloudpulse-multi-tenant-analytics",quantile="0.95"} ${p95}`);
    lines.push(`http_request_duration_ms{service="cloudpulse-multi-tenant-analytics",quantile="0.99"} ${p99}`);

    return lines.join("\n") + "\n";
  }
}
