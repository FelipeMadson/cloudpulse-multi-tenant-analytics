export class TelemetryCollector {
  private counters: Map<string, number> = new Map();
  private startTime = Date.now();

  public increment(metric: string, count = 1): void {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, current + count);
  }

  public getPrometheusMetrics(): string {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const mem = process.memoryUsage();

    let output = "# HELP saas_uptime_seconds Tempo de atividade do processo em segundos\n";
    output += "# TYPE saas_uptime_seconds gauge\nsaas_uptime_seconds " + uptimeSec + "\n\n";

    output += "# HELP saas_memory_heap_bytes Uso de heap memory do Node.js\n";
    output += "# TYPE saas_memory_heap_bytes gauge\nsaas_memory_heap_bytes " + mem.heapUsed + "\n\n";

    for (const [k, v] of this.counters.entries()) {
      output += "# HELP saas_" + k + " Total de execuções de " + k + "\n";
      output += "# TYPE saas_" + k + " counter\nsaas_" + k + " " + v + "\n\n";
    }
    return output;
  }
}
