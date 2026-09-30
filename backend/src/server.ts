/**
 * CloudPulse Multi-Tenant Analytics — Core Enterprise SaaS Platform Server
 * Desenvolvido por Felipe Madison (https://github.com/FelipeMadson)
 * Arquitetura Multi-Tenant com Zero Dependências de Runtime Externas.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { TenantManager } from "./core/tenant-manager.ts";
import { AuthManager } from "./auth/token-manager.ts";
import { StorageEngine } from "./storage/db.ts";
import { DatabaseMigrator } from "./storage/migrator.ts";
import { DatabaseSeeder } from "./storage/seeds/demo-seed.ts";
import { WebhookDispatcher } from "./webhooks/dispatcher.ts";
import { StreamingEventHub } from "./streaming/event-hub.ts";
import { CryptographicVault } from "./security/vault.ts";
import { WorkflowOrchestrator } from "./workflows/orchestrator.ts";
import { getOpenApiSpec } from "./docs/openapi.ts";
import { TelemetryCollector } from "./telemetry/metrics.ts";

export class SaasPlatformServer {
  public tenantManager = new TenantManager();
  public authManager = new AuthManager();
  public storage = new StorageEngine();
  public migrator = new DatabaseMigrator();
  public webhooks = new WebhookDispatcher();
  public streaming = new StreamingEventHub();
  public vault = new CryptographicVault();
  public orchestrator = new WorkflowOrchestrator();
  public telemetry = new TelemetryCollector();
  private server = createServer((req, res) => this.handle(req, res));

  constructor() {
    // Executa migrações e seed inicial
    this.migrator.runAll();
    DatabaseSeeder.seedAll(this.tenantManager, this.authManager, this.storage);
  }

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
        walOperations: this.storage.getWalSize(),
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

    // 3. Documentação Interativa OpenAPI (/docs) & JSON Schema
    if (pathname === "/docs") {
      const docPath = path.resolve(process.cwd(), "backend", "public", "docs.html");
      if (fs.existsSync(docPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(docPath, "utf8"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>CloudPulse Multi-Tenant Analytics — Docs</h1><p>Acesse /openapi.json para a especificação completa.</p>");
      return;
    }

    if (pathname === "/openapi.json" || pathname === "/api/v1/openapi.json") {
      this.sendJson(res, 200, getOpenApiSpec("CloudPulse Multi-Tenant Analytics", "Enterprises struggle to monitor multi-tenant applications with granular data isolation and real-time observability."));
      return;
    }

    // 4. API Endpoints com autenticação e isolamento multi-tenant
    if (pathname.startsWith("/api/v1/")) {
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

      // /api/v1/resources (CRUD multi-tenant com WAL e Webhook)
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

      // /api/v1/stream/events (Streaming Ingestion)
      if (pathname === "/api/v1/stream/events" && method === "POST") {
        const body = await this.readBody(req);
        const eventId = "evt_" + Math.random().toString(36).substring(2, 9);
        this.streaming.ingest({
          id: eventId,
          tenantId: session.tenantId,
          source: body.source || "api",
          eventType: body.eventType || "metric",
          timestamp: Date.now(),
          durationMs: Number(body.durationMs || 10),
          statusCode: Number(body.statusCode || 200),
          data: body.data
        });
        this.sendJson(res, 202, { success: true, eventId });
        return;
      }

      // /api/v1/stream/analytics (Percentil Analytics)
      if (pathname === "/api/v1/stream/analytics" && method === "GET") {
        const metrics = this.streaming.computeWindowMetrics(60_000, session.tenantId);
        this.sendJson(res, 200, { tenantId: session.tenantId, windowMetrics: metrics });
        return;
      }

      // /api/v1/vault/secrets (Zero-Trust Cryptographic Vault)
      if (pathname === "/api/v1/vault/secrets" && method === "POST") {
        const body = await this.readBody(req);
        const secret = this.vault.storeSecret(session.tenantId, body.key, body.value, body.ttlSeconds);
        this.sendJson(res, 201, { success: true, secret });
        return;
      }

      // /api/v1/workflows/run (DAG Orchestrator)
      if (pathname === "/api/v1/workflows/run" && method === "POST") {
        const execution = await this.orchestrator.executeWorkflow("pipeline_deployment", [
          { id: "step_build", name: "Build Container", action: () => ({ success: true }) },
          { id: "step_test", name: "Run Tests", dependencies: ["step_build"], action: () => ({ success: true }) },
          { id: "step_deploy", name: "Deploy to Prod", dependencies: ["step_test"], action: () => ({ success: true }) }
        ]);
        this.sendJson(res, 200, { success: true, execution });
        return;
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

const serverInstance = new SaasPlatformServer();
export default serverInstance;

const isMainModule = process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"));
if (isMainModule && process.env.NODE_ENV !== "test") {
  const PORT = Number(process.env.PORT || 3000);
  serverInstance.listen(PORT).then(p => {
    console.log(`[SaaS-Platform] rodando na porta ${p}`);
  });
}
