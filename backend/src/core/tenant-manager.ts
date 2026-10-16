import { DatabaseSync } from "node:sqlite";

export type SubscriptionTier = "free" | "starter" | "pro" | "enterprise";

export interface Tenant {
  id: string;
  name: string;
  tier: SubscriptionTier;
  createdAt: string;
  quotaPerMinute: number;
  requestCountCurrentMinute: number;
  lastResetTimestamp: number;
}

export class TenantManager {
  private tenants: Map<string, Tenant> = new Map();
  private db?: DatabaseSync;

  constructor(db?: DatabaseSync) {
    this.db = db;

    // Se houver banco, carrega os tenants previamente persistidos
    if (this.db) {
      try {
        const rows = this.db.prepare("SELECT id, name, tier, quota_per_minute, created_at FROM tenants").all() as any[];
        for (const row of rows) {
          this.tenants.set(row.id, {
            id: row.id,
            name: row.name,
            tier: row.tier as SubscriptionTier,
            createdAt: row.created_at,
            quotaPerMinute: Number(row.quota_per_minute),
            requestCountCurrentMinute: 0,
            lastResetTimestamp: Date.now()
          });
        }
      } catch {
        // Tabela ainda pode não ter sido criada se executado antes da migração
      }
    }

    if (!this.tenants.has("tenant-enterprise-acme")) {
      this.registerTenant({
        id: "tenant-enterprise-acme",
        name: "Acme Global Enterprise",
        tier: "enterprise",
        quotaPerMinute: 10000
      });
    }

    if (!this.tenants.has("tenant-starter-sandbox")) {
      this.registerTenant({
        id: "tenant-starter-sandbox",
        name: "Sandbox Starter Corp",
        tier: "starter",
        quotaPerMinute: 300
      });
    }
  }

  public registerTenant(params: { id: string; name: string; tier?: SubscriptionTier; quotaPerMinute?: number }): Tenant {
    const tier = params.tier || "free";
    const quotaMap: Record<SubscriptionTier, number> = {
      free: 60,
      starter: 300,
      pro: 1200,
      enterprise: 10000
    };
    const quota = params.quotaPerMinute || quotaMap[tier];
    const now = new Date().toISOString();

    const tenant: Tenant = {
      id: params.id,
      name: params.name,
      tier,
      createdAt: now,
      quotaPerMinute: quota,
      requestCountCurrentMinute: 0,
      lastResetTimestamp: Date.now()
    };

    this.tenants.set(tenant.id, tenant);

    if (this.db) {
      try {
        this.db.prepare(
          "INSERT OR REPLACE INTO tenants (id, name, tier, quota_per_minute, created_at) VALUES (?, ?, ?, ?, ?)"
        ).run(tenant.id, tenant.name, tenant.tier, tenant.quotaPerMinute, tenant.createdAt);
      } catch {
        // Caso a tabela ainda não exista
      }
    }

    return tenant;
  }

  public getTenant(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  public listTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  public consumeQuota(id: string): { allowed: boolean; remaining: number; tier: SubscriptionTier } {
    const tenant = this.tenants.get(id);
    if (!tenant) return { allowed: false, remaining: 0, tier: "free" };

    const now = Date.now();
    if (now - tenant.lastResetTimestamp > 60_000) {
      tenant.requestCountCurrentMinute = 0;
      tenant.lastResetTimestamp = now;
    }

    if (tenant.requestCountCurrentMinute >= tenant.quotaPerMinute) {
      return { allowed: false, remaining: 0, tier: tenant.tier };
    }

    tenant.requestCountCurrentMinute++;
    const remaining = tenant.quotaPerMinute - tenant.requestCountCurrentMinute;
    return { allowed: true, remaining, tier: tenant.tier };
  }
}
