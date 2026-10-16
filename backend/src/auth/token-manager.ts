import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export interface ApiKeyRecord {
  keyId: string;
  tenantId: string;
  role: "owner" | "admin" | "member";
  secretHash: string;
  revoked: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface AuthAuditLog {
  id: number;
  keyId?: string;
  tenantId: string;
  action: string;
  success: boolean;
  detail?: string;
  createdAt: string;
}

export class AuthManager {
  private masterSecret: string;
  private db?: DatabaseSync;
  private keys: Map<string, ApiKeyRecord> = new Map();

  constructor(masterSecret = "saas-master-entropy-key", db?: DatabaseSync) {
    this.masterSecret = masterSecret;
    this.db = db;

    if (this.db) {
      try {
        const rows = this.db.prepare(
          "SELECT key_id, tenant_id, role, secret_hash, revoked, created_at, last_used_at, expires_at FROM api_keys"
        ).all() as any[];
        for (const row of rows) {
          this.keys.set(row.key_id, {
            keyId: row.key_id,
            tenantId: row.tenant_id,
            role: row.role as any,
            secretHash: row.secret_hash,
            revoked: Boolean(row.revoked),
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at || undefined,
            expiresAt: row.expires_at || undefined
          });
        }
      } catch {}
    }

    if (!this.keys.has("key_demo_enterprise_999")) {
      this.provisionKey("tenant-enterprise-acme", "admin", "sk_live_enterprise_demo_key_999", undefined, "key_demo_enterprise_999");
    }
  }

  public provisionKey(
    tenantId: string,
    role: "owner" | "admin" | "member" = "admin",
    customToken?: string,
    expiresInSeconds?: number,
    fixedKeyId?: string
  ): { token: string; keyId: string; expiresAt?: string } {
    const token = customToken || "sk_live_" + randomBytes(24).toString("hex");
    const keyId = fixedKeyId || "key_" + randomBytes(8).toString("hex");
    const secretHash = this.hashToken(token);
    const now = new Date().toISOString();
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : undefined;

    const record: ApiKeyRecord = {
      keyId,
      tenantId,
      role,
      secretHash,
      revoked: false,
      createdAt: now,
      expiresAt
    };

    this.keys.set(keyId, record);

    if (this.db) {
      try {
        // Garante existência de tenant para integridade referencial
        this.db.prepare(
          "INSERT OR IGNORE INTO tenants (id, name, tier, quota_per_minute, created_at) VALUES (?, ?, 'free', 60, ?)"
        ).run(tenantId, `Tenant ${tenantId}`, now);

        this.db.prepare(
          "INSERT OR REPLACE INTO api_keys (key_id, tenant_id, role, secret_hash, revoked, created_at, expires_at) VALUES (?, ?, ?, ?, 0, ?, ?)"
        ).run(keyId, tenantId, role, secretHash, now, expiresAt || null);

        this.logAudit(keyId, tenantId, "key_provisioned", true, `Role: ${role}`);
      } catch {}
    }

    return { token, keyId, expiresAt };
  }

  public validateToken(rawToken: string): ApiKeyRecord | null {
    if (!rawToken || !rawToken.startsWith("sk_live_")) {
      this.logAudit(undefined, "unknown", "token_format_invalid", false);
      return null;
    }
    const providedHash = this.hashToken(rawToken);

    for (const record of this.keys.values()) {
      if (record.secretHash.length === providedHash.length) {
        const a = Buffer.from(record.secretHash);
        const b = Buffer.from(providedHash);
        if (timingSafeEqual(a, b)) {
          // Checagem de revogação
          if (record.revoked) {
            this.logAudit(record.keyId, record.tenantId, "token_revoked_rejected", false);
            return null;
          }

          // Checagem de expiração
          if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
            this.logAudit(record.keyId, record.tenantId, "token_expired_rejected", false);
            return null;
          }

          const now = new Date().toISOString();
          record.lastUsedAt = now;

          if (this.db) {
            try {
              this.db.prepare("UPDATE api_keys SET last_used_at = ? WHERE key_id = ?").run(now, record.keyId);
            } catch {}
          }

          this.logAudit(record.keyId, record.tenantId, "token_validated", true);
          return record;
        }
      }
    }

    this.logAudit(undefined, "unknown", "token_unrecognized", false);
    return null;
  }

  public revokeKey(keyId: string): boolean {
    const record = this.keys.get(keyId);
    if (!record) return false;

    record.revoked = true;

    if (this.db) {
      try {
        this.db.prepare("UPDATE api_keys SET revoked = 1 WHERE key_id = ?").run(keyId);
        this.logAudit(keyId, record.tenantId, "key_revoked", true);
      } catch {}
    }

    return true;
  }

  public isRevoked(keyId: string): boolean {
    const record = this.keys.get(keyId);
    return Boolean(record?.revoked);
  }

  public listKeys(tenantId: string): ApiKeyRecord[] {
    return Array.from(this.keys.values()).filter(k => k.tenantId === tenantId);
  }

  public getAuditLogs(tenantId?: string, limit = 50): AuthAuditLog[] {
    if (!this.db) return [];
    try {
      let rows: any[];
      if (tenantId) {
        rows = this.db.prepare(
          "SELECT id, key_id, tenant_id, action, success, detail, created_at FROM audit_auth_log WHERE tenant_id = ? ORDER BY id DESC LIMIT ?"
        ).all(tenantId, limit);
      } else {
        rows = this.db.prepare(
          "SELECT id, key_id, tenant_id, action, success, detail, created_at FROM audit_auth_log ORDER BY id DESC LIMIT ?"
        ).all(limit);
      }
      return rows.map(r => ({
        id: Number(r.id),
        keyId: r.key_id || undefined,
        tenantId: r.tenant_id,
        action: r.action,
        success: Boolean(r.success),
        detail: r.detail || undefined,
        createdAt: r.created_at
      }));
    } catch {
      return [];
    }
  }

  private logAudit(keyId: string | undefined, tenantId: string, action: string, success: boolean, detail?: string): void {
    if (!this.db) return;
    try {
      this.db.prepare(
        "INSERT INTO audit_auth_log (key_id, tenant_id, action, success, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(keyId || null, tenantId, action, success ? 1 : 0, detail || null, new Date().toISOString());
    } catch {}
  }

  private hashToken(token: string): string {
    return createHmac("sha256", this.masterSecret).update(token).digest("hex");
  }
}
