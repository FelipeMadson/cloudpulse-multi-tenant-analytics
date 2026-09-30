import { TenantManager } from "../../core/tenant-manager.ts";
import { AuthManager } from "../../auth/token-manager.ts";
import { StorageEngine } from "../db.ts";

export class DatabaseSeeder {
  public static seedAll(tenantManager: TenantManager, authManager: AuthManager, storage: StorageEngine) {
    const ent = tenantManager.registerTenant({
      id: "tenant-enterprise-acme",
      name: "Acme Global Industries",
      tier: "enterprise",
      quotaPerMinute: 10000
    });

    const st = tenantManager.registerTenant({
      id: "tenant-starter-fintech",
      name: "Fintech Sandbox Ltd",
      tier: "starter",
      quotaPerMinute: 300
    });

    const keyEnt = authManager.provisionKey(ent.id, "admin", "sk_live_enterprise_demo_key_999");
    const keySt = authManager.provisionKey(st.id, "member", "sk_live_starter_demo_key_111");

    storage.insert(ent.id, "res_corp_01", "Cluster Primário Global", {
      region: "us-east-1",
      nodes: 16,
      ha: true
    });

    storage.insert(st.id, "res_fin_01", "Fila de Pagamentos Instantâneos", {
      currency: "BRL",
      throughput: "5000/s"
    });

    return {
      tenantsSeeded: 2,
      keysSeeded: 2,
      resourcesSeeded: 2,
      seededAt: new Date().toISOString()
    };
  }
}
