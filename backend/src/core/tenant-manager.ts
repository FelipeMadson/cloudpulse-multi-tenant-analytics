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

  constructor() {
    // Tenant padrão de demonstração
    this.registerTenant({
      id: "tenant-primary",
      name: "Acme Corp (Primary Tenant)",
      tier: "pro",
      quotaPerMinute: 600
    });
  }

  public registerTenant(params: { id: string; name: string; tier?: SubscriptionTier; quotaPerMinute?: number }): Tenant {
    const tier = params.tier || "free";
    const quotaMap: Record<SubscriptionTier, number> = {
      free: 60,
      starter: 300,
      pro: 1200,
      enterprise: 10000
    };
    const tenant: Tenant = {
      id: params.id,
      name: params.name,
      tier,
      createdAt: new Date().toISOString(),
      quotaPerMinute: params.quotaPerMinute || quotaMap[tier],
      requestCountCurrentMinute: 0,
      lastResetTimestamp: Date.now()
    };
    this.tenants.set(tenant.id, tenant);
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
