export interface IngestionEvent {
  id: string;
  tenantId: string;
  source: string;
  eventType: string;
  timestamp: number;
  durationMs: number;
  statusCode: number;
  data?: any;
}

export interface WindowMetrics {
  totalEvents: number;
  avgDurationMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  eventsPerSecond: number;
}

export class StreamingEventHub {
  private buffer: IngestionEvent[] = [];
  private maxBufferSize = 5000;

  public ingest(event: IngestionEvent): void {
    if (this.buffer.length >= this.maxBufferSize) {
      this.buffer.shift();
    }
    this.buffer.push(event);
  }

  public getEvents(tenantId?: string): IngestionEvent[] {
    if (!tenantId) return this.buffer;
    return this.buffer.filter(e => e.tenantId === tenantId);
  }

  public computeWindowMetrics(windowMs = 60_000, tenantId?: string): WindowMetrics {
    const now = Date.now();
    const threshold = now - windowMs;
    const windowEvents = this.buffer.filter(e => 
      e.timestamp >= threshold && (!tenantId || e.tenantId === tenantId)
    );

    if (windowEvents.length === 0) {
      return { totalEvents: 0, avgDurationMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, errorRate: 0, eventsPerSecond: 0 };
    }

    const durations = windowEvents.map(e => e.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);
    const avg = sum / durations.length;
    const errors = windowEvents.filter(e => e.statusCode >= 400).length;

    const p50 = durations[Math.floor(durations.length * 0.50)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    const seconds = Math.max(1, windowMs / 1000);
    return {
      totalEvents: windowEvents.length,
      avgDurationMs: Math.round(avg * 100) / 100,
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      errorRate: Math.round((errors / windowEvents.length) * 10000) / 100,
      eventsPerSecond: Math.round((windowEvents.length / seconds) * 100) / 100
    };
  }
}
