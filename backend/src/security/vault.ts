import { createHmac, randomBytes } from "node:crypto";

export interface SecretItem {
  id: string;
  tenantId: string;
  key: string;
  maskedValue: string;
  checksum: string;
  version: number;
  createdAt: string;
  expiresAt?: string;
}

export interface EphemeralGrant {
  grantId: string;
  tenantId: string;
  secretKey: string;
  accessToken: string;
  expiresAt: number;
}

export class CryptographicVault {
  private masterKey: string;
  private secrets: Map<string, { raw: string; meta: SecretItem }> = new Map();
  private grants: Map<string, EphemeralGrant> = new Map();
  private auditChain: Array<{ index: number; op: string; prevHash: string; hash: string; timestamp: string }> = [];

  constructor(masterKey = "vault-root-secret-entropy") {
    this.masterKey = masterKey;
    this.auditChain.push({
      index: 0,
      op: "GENESIS",
      prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
      hash: this.computeHash("GENESIS-BLOCK"),
      timestamp: new Date().toISOString()
    });
  }

  public storeSecret(tenantId: string, key: string, value: string, ttlSeconds?: number): SecretItem {
    const id = `${tenantId}:${key}`;
    const checksum = this.computeHash(value);
    const masked = value.length > 4 ? value.slice(0, 2) + "•".repeat(value.length - 4) + value.slice(-2) : "••••";
    const now = new Date();
    const expiresAt = ttlSeconds ? new Date(now.getTime() + ttlSeconds * 1000).toISOString() : undefined;

    const meta: SecretItem = {
      id,
      tenantId,
      key,
      maskedValue: masked,
      checksum,
      version: 1,
      createdAt: now.toISOString(),
      expiresAt
    };

    this.secrets.set(id, { raw: value, meta });
    this.recordAudit("STORE_SECRET", id);
    return meta;
  }

  public createEphemeralGrant(tenantId: string, key: string, durationSeconds = 300): EphemeralGrant | null {
    const id = `${tenantId}:${key}`;
    if (!this.secrets.has(id)) return null;

    const grantId = "grant_" + randomBytes(8).toString("hex");
    const accessToken = "ephemeral_" + randomBytes(20).toString("hex");
    const expiresAt = Date.now() + durationSeconds * 1000;

    const grant: EphemeralGrant = {
      grantId,
      tenantId,
      secretKey: key,
      accessToken,
      expiresAt
    };
    this.grants.set(accessToken, grant);
    this.recordAudit("CREATE_GRANT", grantId);
    return grant;
  }

  public accessWithGrant(accessToken: string): string | null {
    const grant = this.grants.get(accessToken);
    if (!grant) return null;
    if (Date.now() > grant.expiresAt) {
      this.grants.delete(accessToken);
      return null;
    }
    const id = `${grant.tenantId}:${grant.secretKey}`;
    const secret = this.secrets.get(id);
    if (!secret) return null;
    this.recordAudit("ACCESS_SECRET", id);
    return secret.raw;
  }

  public getAuditChainLength(): number {
    return this.auditChain.length;
  }

  public verifyAuditIntegrity(): boolean {
    for (let i = 1; i < this.auditChain.length; i++) {
      if (this.auditChain[i].prevHash !== this.auditChain[i - 1].hash) {
        return false;
      }
    }
    return true;
  }

  private recordAudit(op: string, targetId: string) {
    const prev = this.auditChain[this.auditChain.length - 1];
    const rawData = `${prev.hash}:${op}:${targetId}:${Date.now()}`;
    const hash = this.computeHash(rawData);
    this.auditChain.push({
      index: this.auditChain.length,
      op,
      prevHash: prev.hash,
      hash,
      timestamp: new Date().toISOString()
    });
  }

  private computeHash(data: string): string {
    return createHmac("sha256", this.masterKey).update(data).digest("hex");
  }
}
