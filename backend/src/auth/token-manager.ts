import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export interface ApiKeyRecord {
  keyId: string;
  tenantId: string;
  role: "owner" | "admin" | "member";
  secretHash: string;
  createdAt: string;
  lastUsedAt?: string;
}

export class AuthManager {
  private masterSecret: string;
  private keys: Map<string, ApiKeyRecord> = new Map();

  constructor(masterSecret = "saas-master-entropy-key") {
    this.masterSecret = masterSecret;
    // Provisiona uma chave mestre para testes/desenvolvimento
    this.provisionKey("tenant-primary", "admin", "sk_live_master_key_12345");
  }

  public provisionKey(tenantId: string, role: "owner" | "admin" | "member" = "admin", customToken?: string): { token: string; keyId: string } {
    const token = customToken || "sk_live_" + randomBytes(24).toString("hex");
    const keyId = "key_" + randomBytes(8).toString("hex");
    const secretHash = this.hashToken(token);

    this.keys.set(keyId, {
      keyId,
      tenantId,
      role,
      secretHash,
      createdAt: new Date().toISOString()
    });

    return { token, keyId };
  }

  public validateToken(rawToken: string): ApiKeyRecord | null {
    if (!rawToken || !rawToken.startsWith("sk_live_")) return null;
    const providedHash = this.hashToken(rawToken);

    for (const record of this.keys.values()) {
      if (record.secretHash.length === providedHash.length) {
        const a = Buffer.from(record.secretHash);
        const b = Buffer.from(providedHash);
        if (timingSafeEqual(a, b)) {
          record.lastUsedAt = new Date().toISOString();
          return record;
        }
      }
    }
    return null;
  }

  private hashToken(token: string): string {
    return createHmac("sha256", this.masterSecret).update(token).digest("hex");
  }
}
