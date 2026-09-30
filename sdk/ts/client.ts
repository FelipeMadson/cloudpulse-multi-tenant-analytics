/**
 * SDK Oficial TypeScript / Node.js para Cloudpulse Multi Tenant Analytics (cloudpulse-multi-tenant-analytics).
 * Desenvolvido com rigor sênior por Felipe Madison (@FelipeMadson).
 * Zero dependências externas de runtime.
 */

export interface ClientConfig {
  baseUrl?: string;
  authToken?: string;
  tenantId?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
}

export interface ProcessItemResponse {
  id: string;
  tenantId: string;
  correlationId: string;
  key: string;
  hash: string;
  timestamp: string;
  status: "verified" | "flagged" | "processed";
}

export interface HealthResponse {
  status: "healthy" | "degraded";
  uptimeSeconds: number;
  version: string;
}

export class cloudpulsemultitenantanalyticsError extends Error {
  public readonly status?: number;
  public readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "cloudpulsemultitenantanalyticsError";
    this.status = status;
    this.code = code;
  }
}

export class cloudpulsemultitenantanalyticsClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;
  private readonly tenantId: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = (config.baseUrl || "http://127.0.0.1:3000").replace(/\/+$/, "");
    this.authToken = config.authToken;
    this.tenantId = config.tenantId || "default-tenant";
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  private async requestWithRetry<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : "/" + path}`;
    const method = options.method || "GET";
    const headers: Record<string, string> = {
      "Accept": "application/json",
      "User-Agent": "cloudpulse-multi-tenant-analytics-sdk-ts/1.0.0 (FelipeMadson)",
      ...(this.authToken ? { "Authorization": `Bearer ${this.authToken}` } : {}),
      "X-Tenant-ID": this.tenantId,
      ...(options.headers || {})
    };

    if (options.body && method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);

        const response = await fetch(url, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          if (response.status >= 500 && attempt < this.maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 5000);
            await new Promise(res => setTimeout(res, delay));
            continue;
          }
          throw new cloudpulsemultitenantanalyticsError(
            `HTTP ${response.status}: ${errBody || response.statusText}`,
            response.status
          );
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          return (await response.json()) as T;
        }
        return (await response.text()) as unknown as T;

      } catch (err: any) {
        lastError = err;
        if (err.name === "AbortError") {
          lastError = new cloudpulsemultitenantanalyticsError(`Requisição excedeu timeout de ${options.timeoutMs ?? this.timeoutMs}ms`, 408);
        }
        if (attempt < this.maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt) + Math.random() * 200, 4000);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
      }
    }

    throw lastError || new cloudpulsemultitenantanalyticsError("Falha na requisição após múltiplas tentativas.");
  }

  public async checkHealth(): Promise<HealthResponse> {
    return this.requestWithRetry<HealthResponse>("/health");
  }

  public async processItem(key: string, payload: any, customTenant?: string): Promise<ProcessItemResponse> {
    return this.requestWithRetry<ProcessItemResponse>("/api/v1/items", {
      method: "POST",
      headers: customTenant ? { "X-Tenant-ID": customTenant } : {},
      body: { key, payload }
    });
  }

  public async verifyRecord(recordId: string): Promise<{ id: string; verified: boolean; hash: string }> {
    return this.requestWithRetry<{ id: string; verified: boolean; hash: string }>(`/api/v1/verify/${encodeURIComponent(recordId)}`);
  }

  public async getMetrics(): Promise<string> {
    return this.requestWithRetry<string>("/metrics");
  }
}

export function createClient(config: ClientConfig = {}): cloudpulsemultitenantanalyticsClient {
  return new cloudpulsemultitenantanalyticsClient(config);
}
