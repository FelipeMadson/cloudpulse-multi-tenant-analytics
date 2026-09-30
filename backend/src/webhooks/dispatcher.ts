import { createHmac } from "node:crypto";

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

export class WebhookDispatcher {
  private queue: WebhookEvent[] = [];
  private delivered: WebhookEvent[] = [];

  public enqueue(tenantId: string, topic: string, payload: any, targetUrl: string, secret: string): WebhookEvent {
    const event: WebhookEvent = {
      id: "evt_" + Math.random().toString(36).substring(2, 10),
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
    return event;
  }

  public computeSignature(payload: any, secret: string): string {
    const bodyStr = JSON.stringify(payload);
    return createHmac("sha256", secret).update(bodyStr).digest("hex");
  }

  public async processQueueSimulated(): Promise<{ deliveredCount: number; pendingCount: number }> {
    let deliveredCount = 0;
    while (this.queue.length > 0) {
      const ev = this.queue.shift()!;
      ev.attempts++;
      ev.status = "delivered";
      this.delivered.push(ev);
      deliveredCount++;
    }
    return { deliveredCount, pendingCount: this.queue.length };
  }

  public listDelivered(tenantId: string): WebhookEvent[] {
    return this.delivered.filter(e => e.tenantId === tenantId);
  }
}
