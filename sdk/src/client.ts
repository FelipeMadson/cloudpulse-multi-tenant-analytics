/**
 * SDK Cliente Oficial Isomórfico para ${ctx.title}
 * Autoria: Felipe Madison (@FelipeMadson)
 * Zero dependências externas de runtime.
 */

export interface ClientOptions {
  baseUrl?: string;
  apiToken: string;
}

export class SaasApiClient {
  private baseUrl: string;
  private apiToken: string;

  constructor(options: ClientOptions) {
    this.baseUrl = (options.baseUrl || "http://localhost:3000").replace(/\/$/, "");
    this.apiToken = options.apiToken;
  }

  private async request<T>(endpoint: string, options: any = {}): Promise<T> {
    const url = this.baseUrl + endpoint;
    const headers: Record<string, string> = {
      "Authorization": "Bearer " + this.apiToken,
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error("[SaasApiClient] HTTP " + res.status + ": " + ((err as any).error || res.statusText));
    }
    return res.json() as Promise<T>;
  }

  public tenants = {
    list: () => this.request<{ tenants: any[] }>("/api/v1/tenants")
  };

  public resources = {
    list: () => this.request<{ resources: any[] }>("/api/v1/resources"),
    create: (title: string, data: any) => this.request<{ success: boolean; resource: any }>("/api/v1/resources", {
      method: "POST",
      body: JSON.stringify({ title, data })
    })
  };

  public stream = {
    ingest: (event: { source: string; eventType: string; durationMs: number; statusCode?: number; data?: any }) =>
      this.request<{ success: boolean; eventId: string }>("/api/v1/stream/events", {
        method: "POST",
        body: JSON.stringify(event)
      }),
    getAnalytics: () => this.request<{ windowMetrics: any }>("/api/v1/stream/analytics")
  };

  public vault = {
    storeSecret: (key: string, value: string, ttlSeconds?: number) =>
      this.request<{ success: boolean; secret: any }>("/api/v1/vault/secrets", {
        method: "POST",
        body: JSON.stringify({ key, value, ttlSeconds })
      })
  };

  public workflows = {
    run: () => this.request<{ success: boolean; execution: any }>("/api/v1/workflows/run", {
      method: "POST"
    })
  };

  public health = {
    check: () => fetch(this.baseUrl + "/health").then(r => r.json())
  };
}
