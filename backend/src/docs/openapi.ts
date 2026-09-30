export function getOpenApiSpec(title: string, description: string): any {
  return {
    openapi: "3.0.3",
    info: {
      title: title + " — Enterprise Platform API",
      version: "1.0.0",
      description: description,
      contact: {
        name: "Felipe Madison",
        url: "https://github.com/FelipeMadson"
      }
    },
    servers: [
      { url: "http://localhost:3000", description: "Ambiente Local-First" }
    ],
    paths: {
      "/health": {
        get: {
          summary: "Sonda de Integridade & Métricas de Heap",
          responses: {
            "200": { description: "Serviço operacional" }
          }
        }
      },
      "/metrics": {
        get: {
          summary: "Telemetria no formato Prometheus",
          responses: {
            "200": { description: "Exposição de métricas Prometheus text/plain" }
          }
        }
      },
      "/api/v1/tenants": {
        get: {
          summary: "Listagem de Tenants",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Lista de tenants cadastrados" } }
        }
      },
      "/api/v1/resources": {
        get: {
          summary: "Recursos Isolados do Tenant",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Recursos do tenant autenticado" } }
        },
        post: {
          summary: "Criação de Recurso com WAL e Webhook",
          security: [{ BearerAuth: [] }],
          responses: { "201": { description: "Recurso criado com sucesso" } }
        }
      },
      "/api/v1/stream/events": {
        post: {
          summary: "Ingestão de Eventos em Alta Escala",
          security: [{ BearerAuth: [] }],
          responses: { "202": { description: "Evento aceito no buffer de streaming" } }
        }
      },
      "/api/v1/stream/analytics": {
        get: {
          summary: "Agregação de Percentis de Latência (P50, P95, P99)",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Métricas calculadas sobre a janela deslizante" } }
        }
      },
      "/api/v1/vault/secrets": {
        post: {
          summary: "Armazenamento Criptográfico de Segredo",
          security: [{ BearerAuth: [] }],
          responses: { "201": { description: "Segredo armazenado com Merkle audit log" } }
        }
      },
      "/api/v1/workflows/run": {
        post: {
          summary: "Execução de Workflow DAG Orquestrado",
          security: [{ BearerAuth: [] }],
          responses: { "200": { description: "Execução concluída com sucesso" } }
        }
      }
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT/HMAC"
        }
      }
    }
  };
}
