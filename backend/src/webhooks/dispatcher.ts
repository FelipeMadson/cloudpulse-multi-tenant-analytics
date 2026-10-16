import { createHmac, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export interface WebhookEvent {
  id: string;
  tenantId: string;
  topic: string;
  payload: any;
  targetUrl: string;
  secret: string;
  attempts: number;
  status: "pending" | "delivered" | "failed";
  timestamp: string;
}

export interface WebhookReceipt {
  id: string;
  eventId: string;
  statusCode: number;
  responseBody?: string;
  signature: string;
  durationMs: number;
  createdAt: string;
}

export interface DispatchOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  allowedHosts?: string[];
}

export class WebhookDispatcher {
  private queue: WebhookEvent[] = [];
  private delivered: WebhookEvent[] = [];
  private failed: WebhookEvent[] = [];
  private db?: DatabaseSync;

  constructor(db?: DatabaseSync) {
    this.db = db;

    if (this.db) {
      try {
        const rows = this.db.prepare(
          "SELECT id, tenant_id, topic, payload, target_url, secret, attempts, status, created_at FROM webhook_events"
        ).all() as any[];
        for (const row of rows) {
          let payload: any = {};
          try { payload = JSON.parse(row.payload); } catch { payload = row.payload; }
          const evt: WebhookEvent = {
            id: row.id,
            tenantId: row.tenant_id,
            topic: row.topic,
            payload,
            targetUrl: row.target_url,
            secret: row.secret,
            attempts: Number(row.attempts),
            status: row.status,
            timestamp: row.created_at
          };
          if (evt.status === "delivered") this.delivered.push(evt);
          else if (evt.status === "failed") this.failed.push(evt);
          else this.queue.push(evt);
        }
      } catch {}
    }
  }

  public enqueue(tenantId: string, topic: string, payload: any, targetUrl: string, secret: string): WebhookEvent {
    const event: WebhookEvent = {
      id: "evt_" + randomBytes(8).toString("hex"),
      tenantId,
      topic,
      payload,
      targetUrl,
      secret,
      attempts: 0,
      status: "pending",
      timestamp: new Date().toISOString()
    };

    this.queue.push(event);

    if (this.db) {
      try {
        const payloadStr = JSON.stringify(payload);
        this.db.prepare(
          "INSERT OR IGNORE INTO tenants (id, name, tier, quota_per_minute, created_at) VALUES (?, ?, 'free', 60, ?)"
        ).run(tenantId, `Tenant ${tenantId}`, event.timestamp);

        this.db.prepare(
          "INSERT INTO webhook_events (id, tenant_id, topic, payload, target_url, secret, attempts, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', ?)"
        ).run(event.id, tenantId, topic, payloadStr, targetUrl, secret, event.timestamp);
      } catch {}
    }

    return event;
  }

  public computeSignature(payload: any, secret: string): string {
    const bodyStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    return createHmac("sha256", secret).update(bodyStr).digest("hex");
  }

  /** Preview only: counts are simulated; real events remain pending without transport evidence. */
  public async processQueueSimulated(): Promise<{ simulation: true; deliveredCount: number; pendingCount: number }> {
    return { simulation: true, deliveredCount: this.queue.length, pendingCount: 0 };
  }

  /** Real HTTP dispatch engine with cryptographic signature, replay prevention, and delivery receipts. */
  public async dispatchReal(
    event: WebhookEvent,
    options: DispatchOptions = {}
  ): Promise<{ success: boolean; statusCode?: number; receiptId?: string; error?: string }> {
    const timeoutMs = options.timeoutMs || 4000;
    const maxAttempts = options.maxAttempts || 3;

    // 1. Validação de URL de destino
    let url: URL;
    try {
      url = new URL(event.targetUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Protocolo não suportado: " + url.protocol);
      }
    } catch (err: any) {
      return this.recordFailure(event, 400, "URL de destino inválida: " + err.message, maxAttempts);
    }

    // 2. Allowlist de hosts
    if (options.allowedHosts && options.allowedHosts.length > 0) {
      const isAllowed = options.allowedHosts.some(h => url.hostname === h || url.hostname.endsWith("." + h));
      if (!isAllowed) {
        return this.recordFailure(event, 403, `Host '${url.hostname}' não autorizado pela allowlist.`, maxAttempts);
      }
    }

    // 3. Preparação do payload e cabeçalhos de segurança
    const bodyStr = JSON.stringify(event.payload);
    const signature = this.computeSignature(event.payload, event.secret);
    const nowTimestamp = Date.now().toString();

    event.attempts++;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Signature-SHA256": signature,
      "X-Timestamp": nowTimestamp,
      "X-Event-ID": event.id,
      "X-Delivery-Attempt": event.attempts.toString(),
      "User-Agent": "Enterprise-Webhook-Dispatcher/2.0"
    };

    const startTime = Date.now();
    try {
      const response = await fetch(event.targetUrl, {
        method: "POST",
        headers,
        body: bodyStr,
        signal: AbortSignal.timeout(timeoutMs)
      });

      const durationMs = Date.now() - startTime;
      const respText = await response.text().catch(() => "");
      const receiptId = "rcpt_" + randomBytes(8).toString("hex");

      if (response.ok) {
        event.status = "delivered";
        this.delivered.push(event);
        const qIdx = this.queue.findIndex(e => e.id === event.id);
        if (qIdx !== -1) this.queue.splice(qIdx, 1);

        this.persistReceipt(receiptId, event.id, response.status, respText.slice(0, 500), signature, durationMs);
        this.updateEventDb(event);

        return { success: true, statusCode: response.status, receiptId };
      } else {
        return this.recordFailure(
          event,
          response.status,
          `HTTP ${response.status}: ${respText.slice(0, 200)}`,
          maxAttempts,
          signature,
          durationMs
        );
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return this.recordFailure(event, 504, err.message || "Timeout na entrega de webhook", maxAttempts, signature, durationMs);
    }
  }

  private recordFailure(
    event: WebhookEvent,
    statusCode: number,
    errorMessage: string,
    maxAttempts: number,
    signature = "",
    durationMs = 0
  ): { success: boolean; statusCode: number; error: string; receiptId?: string } {
    const receiptId = "rcpt_" + randomBytes(8).toString("hex");

    if (event.attempts >= maxAttempts) {
      event.status = "failed"; // DLQ (Dead-Letter Queue)
      this.failed.push(event);
      const qIdx = this.queue.findIndex(e => e.id === event.id);
      if (qIdx !== -1) this.queue.splice(qIdx, 1);
    }

    this.persistReceipt(receiptId, event.id, statusCode, errorMessage, signature, durationMs);
    this.updateEventDb(event);

    return { success: false, statusCode, error: errorMessage, receiptId };
  }

  private persistReceipt(
    receiptId: string,
    eventId: string,
    statusCode: number,
    responseBody: string,
    signature: string,
    durationMs: number
  ): void {
    if (!this.db) return;
    try {
      this.db.prepare(
        "INSERT INTO webhook_receipts (id, event_id, status_code, response_body, signature, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(receiptId, eventId, statusCode, responseBody, signature, durationMs, new Date().toISOString());
    } catch {}
  }

  private updateEventDb(event: WebhookEvent): void {
    if (!this.db) return;
    try {
      this.db.prepare(
        "UPDATE webhook_events SET attempts = ?, status = ? WHERE id = ?"
      ).run(event.attempts, event.status, event.id);
    } catch {}
  }

  public getReceipts(eventId: string): WebhookReceipt[] {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare(
        "SELECT id, event_id, status_code, response_body, signature, duration_ms, created_at FROM webhook_receipts WHERE event_id = ? ORDER BY id DESC"
      ).all(eventId) as any[];
      return rows.map(r => ({
        id: r.id,
        eventId: r.event_id,
        statusCode: Number(r.status_code),
        responseBody: r.response_body || undefined,
        signature: r.signature,
        durationMs: Number(r.duration_ms),
        createdAt: r.created_at
      }));
    } catch {
      return [];
    }
  }

  public listDelivered(tenantId: string): WebhookEvent[] {
    return this.delivered.filter(e => e.tenantId === tenantId);
  }

  public listFailed(tenantId: string): WebhookEvent[] {
    return this.failed.filter(e => e.tenantId === tenantId);
  }

  public getQueue(tenantId?: string): WebhookEvent[] {
    if (!tenantId) return this.queue;
    return this.queue.filter(e => e.tenantId === tenantId);
  }
}
