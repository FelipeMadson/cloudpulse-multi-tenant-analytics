import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { StorageEngine } from "../src/storage/db.ts";
import { DatabaseMigrator } from "../src/storage/migrator.ts";
import { AuthManager } from "../src/auth/token-manager.ts";
import { WebhookDispatcher, type WebhookEvent } from "../src/webhooks/dispatcher.ts";
import { WorkflowOrchestrator } from "../src/workflows/orchestrator.ts";

describe("Persistência SQLite Durável, Transações & Garantias Enterprise", () => {
  const tempDbDir = path.join(process.cwd(), "data", "test-dbs");
  const testDbFile = path.join(tempDbDir, "persistence-test.db");

  before(() => {
    fs.mkdirSync(tempDbDir, { recursive: true });
    if (fs.existsSync(testDbFile)) {
      fs.unlinkSync(testDbFile);
    }
  });

  after(() => {
    try {
      if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
      const walFile = testDbFile + "-wal";
      const shmFile = testDbFile + "-shm";
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
    } catch {}
  });

  test("1. Durabilidade Real em Disco: Dados sobrevivem ao fechamento e reabertura do arquivo SQLite", () => {
    // Instância 1: Inicializa e persiste dados no arquivo físico
    const engine1 = new StorageEngine(testDbFile);
    engine1.insert("tenant-persistent", "res-disk-001", "Recurso em Disco", { persisted: true, value: 42 });
    engine1.insert("tenant-persistent", "res-disk-002", "Segundo Recurso", { count: 100 });

    assert.strictEqual(engine1.count(), 2);
    assert.strictEqual(engine1.getWalSize(), 2);

    // Fecha a conexão do banco
    engine1.close();

    // Verifica que o arquivo físico existe no sistema de arquivos
    assert.ok(fs.existsSync(testDbFile), "Arquivo físico de banco de dados deve existir em disco");

    // Instância 2: Abre uma nova conexão apontando para o mesmo arquivo físico
    const engine2 = new StorageEngine(testDbFile);

    // Valida que os dados continuam intactos
    const item1 = engine2.get("tenant-persistent", "res-disk-001");
    assert.ok(item1 !== null, "Recurso 1 deve ser recuperado após reabertura");
    assert.strictEqual(item1?.title, "Recurso em Disco");
    assert.strictEqual(item1?.data.value, 42);

    const item2 = engine2.get("tenant-persistent", "res-disk-002");
    assert.ok(item2 !== null, "Recurso 2 deve ser recuperado após reabertura");
    assert.strictEqual(item2?.title, "Segundo Recurso");

    assert.strictEqual(engine2.count(), 2);
    assert.strictEqual(engine2.getWalSize(), 2);

    engine2.close();
  });

  test("2. Atomicidade e Rollback Transacional: Exceção reverte 100% das escritas sem estado parcial", () => {
    const engine = new StorageEngine(":memory:");
    const initialCount = engine.count();
    const initialWal = engine.getWalSize();

    assert.throws(() => {
      engine.executeTransaction(() => {
        engine.insert("tenant-trx", "res-trx-1", "Passo 1 OK", { step: 1 });
        engine.insert("tenant-trx", "res-trx-2", "Passo 2 OK", { step: 2 });
        // Simula falha catastrófica no meio da transação
        throw new Error("FALHA_SIMULADA_DE_INTEGRIDADE");
      });
    }, /FALHA_SIMULADA_DE_INTEGRIDADE/);

    // Nenhuma das escritas deve ter sido persistida
    assert.strictEqual(engine.count(), initialCount, "Contagem não deve mudar após rollback");
    assert.strictEqual(engine.getWalSize(), initialWal, "WAL não deve registrar escritas desfeitas");
    assert.strictEqual(engine.get("tenant-trx", "res-trx-1"), null);
    assert.strictEqual(engine.get("tenant-trx", "res-trx-2"), null);

    engine.close();
  });

  test("3. Isolamento Estrito Multi-Tenant: Tenant B nunca acessa registros de Tenant A", () => {
    const engine = new StorageEngine(":memory:");

    engine.insert("tenant-alpha", "doc-secret", "Plano Estratégico", { budget: 5000000 });
    engine.insert("tenant-beta", "doc-public", "Comunicado Aberto", { topic: "all-hands" });

    // Consulta por tenant Alpha
    const alphaItems = engine.listByTenant("tenant-alpha");
    assert.strictEqual(alphaItems.length, 1);
    assert.strictEqual(alphaItems[0].id, "doc-secret");

    // Consulta por tenant Beta
    const betaItems = engine.listByTenant("tenant-beta");
    assert.strictEqual(betaItems.length, 1);
    assert.strictEqual(betaItems[0].id, "doc-public");

    // Tentativa cruzada de acesso
    assert.strictEqual(engine.get("tenant-beta", "doc-secret"), null);
    assert.strictEqual(engine.get("tenant-alpha", "doc-public"), null);

    engine.close();
  });

  test("4. CRUD Completo e Rastreabilidade no Log de Auditoria WAL", () => {
    const engine = new StorageEngine(":memory:");

    // 1. Create
    const created = engine.insert("tenant-crud", "item-01", "Título Original", { status: "draft" });
    assert.strictEqual(created.version, 1);

    // 2. Read
    const read = engine.get("tenant-crud", "item-01");
    assert.strictEqual(read?.title, "Título Original");

    // 3. Update
    const updated = engine.update("tenant-crud", "item-01", "Título Atualizado", { status: "published" });
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.title, "Título Atualizado");

    // 4. Delete
    const deleted = engine.delete("tenant-crud", "item-01");
    assert.strictEqual(deleted, true);
    assert.strictEqual(engine.get("tenant-crud", "item-01"), null);

    // 5. Auditoria WAL
    const logs = engine.getWalLogs(10);
    assert.strictEqual(logs.length, 3);
    assert.strictEqual(logs[0].op, "DELETE");
    assert.strictEqual(logs[1].op, "UPDATE");
    assert.strictEqual(logs[2].op, "INSERT");

    engine.close();
  });

  test("5. Autenticação Corporativa: Revogação imediata, Expiração e Auditoria de Acesso", () => {
    const engine = new StorageEngine(":memory:");
    const auth = new AuthManager("test-entropy-secret", engine.getDatabase());

    // Provisão de chave comum
    const { token, keyId } = auth.provisionKey("tenant-auth-corp", "admin");

    // Validação inicial válida
    const session = auth.validateToken(token);
    assert.ok(session !== null);
    assert.strictEqual(session?.tenantId, "tenant-auth-corp");

    // Revogação de chave
    const revoked = auth.revokeKey(keyId);
    assert.strictEqual(revoked, true);
    assert.strictEqual(auth.isRevoked(keyId), true);

    // Tentativa com chave revogada deve ser rejeitada
    const sessionAfterRevoke = auth.validateToken(token);
    assert.strictEqual(sessionAfterRevoke, null, "Token revogado deve retornar null");

    // Provisão com expiração no passado (1 segundo negativo)
    const expiredProv = auth.provisionKey("tenant-auth-corp", "member", undefined, -1);
    const sessionExpired = auth.validateToken(expiredProv.token);
    assert.strictEqual(sessionExpired, null, "Token expirado deve retornar null");

    // Checagem do log de auditoria
    const auditLogs = auth.getAuditLogs("tenant-auth-corp");
    assert.ok(auditLogs.length >= 3);
    const actions = auditLogs.map(l => l.action);
    assert.ok(actions.includes("key_provisioned"));
    assert.ok(actions.includes("key_revoked"));
    assert.ok(actions.includes("token_revoked_rejected"));

    engine.close();
  });

  test("6. Webhook Dispatcher Real: Assinatura HMAC, Cabeçalhos de Replay, Recibos e DLQ", async () => {
    const engine = new StorageEngine(":memory:");
    const dispatcher = new WebhookDispatcher(engine.getDatabase());

    // Cria mock HTTP receiver
    let receivedHeaders: any = null;
    let receivedBody: any = null;
    let mockStatus = 200;

    const mockServer: Server = createServer((req, res) => {
      receivedHeaders = req.headers;
      let data = "";
      req.on("data", c => data += c);
      req.on("end", () => {
        try { receivedBody = JSON.parse(data); } catch { receivedBody = data; }
        res.writeHead(mockStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ acknowledged: true }));
      });
    });

    const mockPort = await new Promise<number>((resolve) => {
      mockServer.listen(0, () => {
        const addr = mockServer.address() as any;
        resolve(addr.port);
      });
    });

    const targetUrl = `http://127.0.0.1:${mockPort}/webhook`;
    const secret = "test-webhook-secret-999";
    const payload = { event: "deploy.completed", commit: "abcdef12345" };

    const event = dispatcher.enqueue("tenant-wh", "deploy.completed", payload, targetUrl, secret);
    assert.strictEqual(event.status, "pending");

    // 1. Despacho Real bem-sucedido
    const dispatchResult = await dispatcher.dispatchReal(event, { timeoutMs: 3000, maxAttempts: 2 });
    assert.strictEqual(dispatchResult.success, true);
    assert.strictEqual(dispatchResult.statusCode, 200);
    assert.strictEqual(event.status, "delivered");

    // Verifica cabeçalhos de segurança recebidos pelo servidor
    assert.ok(receivedHeaders["x-signature-sha256"]);
    assert.ok(receivedHeaders["x-timestamp"]);
    assert.strictEqual(receivedHeaders["x-event-id"], event.id);
    assert.strictEqual(receivedHeaders["x-delivery-attempt"], "1");
    assert.strictEqual(receivedBody.event, "deploy.completed");

    // Verifica persistência de recibo no banco
    const receipts = dispatcher.getReceipts(event.id);
    assert.strictEqual(receipts.length, 1);
    assert.strictEqual(receipts[0].statusCode, 200);

    // 2. Simula falha e DLQ (Dead-Letter Queue)
    mockStatus = 500;
    const failingEvent = dispatcher.enqueue("tenant-wh", "order.failed", { orderId: 777 }, targetUrl, secret);
    const failResult1 = await dispatcher.dispatchReal(failingEvent, { timeoutMs: 3000, maxAttempts: 2 });
    assert.strictEqual(failResult1.success, false);
    assert.strictEqual(failingEvent.status, "pending"); // tentativa 1 de 2

    const failResult2 = await dispatcher.dispatchReal(failingEvent, { timeoutMs: 3000, maxAttempts: 2 });
    assert.strictEqual(failResult2.success, false);
    assert.strictEqual(failingEvent.status, "failed"); // Atingiu maxAttempts -> DLQ

    const dlqList = dispatcher.listFailed("tenant-wh");
    assert.strictEqual(dlqList.length, 1);
    assert.strictEqual(dlqList[0].id, failingEvent.id);

    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    engine.close();
  });

  test("7. Workflow Orchestrator: Execução DAG e Persistência do Histórico no SQLite", async () => {
    const engine = new StorageEngine(":memory:");
    const orchestrator = new WorkflowOrchestrator(engine.getDatabase());

    let taskStep1 = false;
    let taskStep2 = false;

    const execution = await orchestrator.executeWorkflow("pipeline_deployment", [
      {
        id: "step_build",
        name: "Compilação de Artefato",
        action: async () => {
          taskStep1 = true;
          return { success: true, data: { bundleSize: 450000 } };
        }
      },
      {
        id: "step_deploy",
        name: "Deploy em Ambiente Isolado",
        dependencies: ["step_build"],
        action: async () => {
          taskStep2 = true;
          return { success: true, data: { deployedHost: "local-runner-1" } };
        }
      }
    ]);

    assert.strictEqual(execution.status, "completed");
    assert.strictEqual(taskStep1, true);
    assert.strictEqual(taskStep2, true);
    assert.strictEqual(execution.steps["step_build"].status, "completed");
    assert.strictEqual(execution.steps["step_deploy"].status, "completed");

    // Valida persistência recuperada
    const loaded = orchestrator.getExecution(execution.executionId);
    assert.ok(loaded !== undefined);
    assert.strictEqual(loaded?.workflowName, "pipeline_deployment");
    assert.strictEqual(loaded?.status, "completed");

    engine.close();
  });
});
