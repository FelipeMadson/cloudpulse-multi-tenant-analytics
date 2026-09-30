/**
 * CloudPulse Multi-Tenant Analytics — Core Enterprise SaaS Platform Server
 * Desenvolvido por Felipe Madison (https://github.com/FelipeMadson)
 * Arquitetura Multi-Tenant com Zero Dependências de Runtime Externas.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { TenantManager } from "./core/tenant-manager.ts";
import { AuthManager } from "./auth/token-manager.ts";
import { StorageEngine } from "./storage/db.ts";
import { WebhookDispatcher } from "./webhooks/dispatcher.ts";
import { TelemetryCollector } from "./telemetry/metrics.ts";

export class SaasPlatformServer {
  public tenantManager = new TenantManager();
  public authManager = new AuthManager();
  public storage = new StorageEngine();
  public webhooks = new WebhookDispatcher();
  public telemetry = new TelemetryCollector();
  private server = createServer((req, res) => this.handle(req, res));

  public listen(port: number): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(port, () => resolve(port));
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rawUrl = req.url || "/";
    const parsed = new URL(rawUrl, "http://localhost");
    const method = req.method?.toUpperCase() || "GET";
    const pathname = parsed.pathname;

    this.telemetry.increment("http_requests_total");

    // 1. Health Probe
    if (pathname === "/health" || pathname === "/health/live") {
      this.sendJson(res, 200, {
        status: "UP",
        service: "cloudpulse-multi-tenant-analytics",
        version: "1.0.0",
        uptimeSeconds: process.uptime(),
        tenantsCount: this.tenantManager.listTenants().length,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 2. Prometheus Metrics
    if (pathname === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(this.telemetry.getPrometheusMetrics());
      return;
    }

    // 3. OpenAPI 3.0 dynamic schema
    if (pathname === "/api/v1/openapi.json") {
      this.sendJson(res, 200, {
        openapi: "3.0.0",
        info: {
          title: "CloudPulse Multi-Tenant Analytics API",
          version: "1.0.0",
          description: "Plataformas de métricas cobram fortunas por ingestão de eventos e não oferecem isolamento de dados por tenant."
        },
        paths: {
          "/health": { get: { summary: "Health Check Probe" } },
          "/api/v1/tenants": { get: { summary: "List Tenants" }, post: { summary: "Register Tenant" } },
          "/api/v1/resources": { get: { summary: "List Tenant Resources" }, post: { summary: "Create Resource" } },
          "/api/v1/webhooks": { post: { summary: "Enqueue Webhook Event" } }
        }
      });
      return;
    }

    // 4. API Endpoints com autenticação e isolamento multi-tenant
    if (pathname.startsWith("/api/v1/")) {
      // Autenticação Bearer
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const session = this.authManager.validateToken(token);

      if (!session) {
        this.sendJson(res, 401, { error: "Não autorizado. Token de API inválido ou ausente." });
        return;
      }

      // Validação de Quota & Rate Limiting por Tenant
      const quota = this.tenantManager.consumeQuota(session.tenantId);
      if (!quota.allowed) {
        this.sendJson(res, 429, {
          error: "Limite de requisições excedido para o plano " + quota.tier + ".",
          tier: quota.tier
        });
        return;
      }

      res.setHeader("X-RateLimit-Remaining", quota.remaining.toString());

      // /api/v1/tenants
      if (pathname === "/api/v1/tenants" && method === "GET") {
        this.sendJson(res, 200, { tenants: this.tenantManager.listTenants() });
        return;
      }

      // /api/v1/resources (CRUD multi-tenant)
      if (pathname === "/api/v1/resources") {
        if (method === "GET") {
          const items = this.storage.listByTenant(session.tenantId);
          this.sendJson(res, 200, { tenantId: session.tenantId, resources: items });
          return;
        }

        if (method === "POST") {
          const body = await this.readBody(req);
          const id = body.id || "res_" + Math.random().toString(36).substring(2, 9);
          const title = body.title || "Novo Recurso";
          const entity = this.storage.insert(session.tenantId, id, title, body.data || {});

          // Dispara webhook automaticamente
          this.webhooks.enqueue(
            session.tenantId,
            "resource.created",
            { resourceId: entity.id, title: entity.title },
            "https://api.example.com/webhook-receiver",
            "webhook-secret"
          );

          this.sendJson(res, 201, { success: true, resource: entity });
          return;
        }
      }
    }

    this.sendJson(res, 404, { error: "Endpoint não encontrado." });
  }

  private sendJson(res: ServerResponse, status: number, data: any): void {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  }

  private readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve({}); }
      });
    });
  }
}

// Inicia servidor em modo standalone se executado diretamente como script principal
const serverInstance = new SaasPlatformServer();
export default serverInstance;

const isMainModule = process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"));
if (isMainModule && process.env.NODE_ENV !== "test") {
  const PORT = Number(process.env.PORT || 3000);
  serverInstance.listen(PORT).then(p => {
    console.log(`[SaaS-Platform] rodando na porta ${p}`);
  });
}
