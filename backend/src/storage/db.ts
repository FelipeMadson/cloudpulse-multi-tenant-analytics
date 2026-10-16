import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DatabaseMigrator } from "./migrator.ts";

export interface ResourceEntity {
  id: string;
  tenantId: string;
  title: string;
  data: any;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalLogEntry {
  id: number;
  op: "INSERT" | "UPDATE" | "DELETE";
  resourceId: string;
  tenantId: string;
  snapshot: any;
  createdAt: string;
}

export class StorageEngine {
  private db: DatabaseSync;
  private dbPath: string;
  private inTransaction = false;

  constructor(customDbPath?: string) {
    const isTest = process.execArgv.some(a => a.includes("--test")) ||
                   process.argv.some(a => a.includes("test")) ||
                   process.env.NODE_ENV === "test";

    this.dbPath = customDbPath || process.env.DB_PATH || (isTest ? ":memory:" : path.join(process.cwd(), "data", "app.db"));

    if (this.dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    if (this.dbPath !== ":memory:") {
      try {
        this.db.exec("PRAGMA journal_mode = WAL;");
      } catch {
        // Fallback se o sistema de arquivos não aceitar WAL
      }
    }
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA busy_timeout = 5000;");

    // Aplica schema migrado automaticamente
    const migrator = new DatabaseMigrator(this.db);
    migrator.runAll();
  }

  public getDatabase(): DatabaseSync {
    return this.db;
  }

  public getPath(): string {
    return this.dbPath;
  }

  public insert(tenantId: string, id: string, title: string, data: any): ResourceEntity {
    // Validação de unicidade
    const existing = this.db.prepare("SELECT id FROM resources WHERE id = ?").get(id);
    if (existing) {
      throw new Error(`Recurso com ID '${id}' já existe.`);
    }

    // Garante existência de tenant para integridade referencial
    const now = new Date().toISOString();
    this.db.prepare(
      "INSERT OR IGNORE INTO tenants (id, name, tier, quota_per_minute, created_at) VALUES (?, ?, 'free', 60, ?)"
    ).run(tenantId, `Tenant ${tenantId}`, now);

    const serializedData = JSON.stringify(data ?? {});

    this.executeTransaction(() => {
      this.db.prepare(
        "INSERT INTO resources (id, tenant_id, title, data, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
      ).run(id, tenantId, title, serializedData, now, now);

      this.db.prepare(
        "INSERT INTO audit_wal_log (op, resource_id, tenant_id, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run("INSERT", id, tenantId, serializedData, now);
    });

    return {
      id,
      tenantId,
      title,
      data,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
  }

  public get(tenantId: string, id: string): ResourceEntity | null {
    const row = this.db.prepare(
      "SELECT id, tenant_id, title, data, version, created_at, updated_at FROM resources WHERE id = ? AND tenant_id = ?"
    ).get(id, tenantId) as any;

    if (!row) return null;

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(row.data);
    } catch {
      parsedData = row.data;
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      data: parsedData,
      version: Number(row.version),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public update(tenantId: string, id: string, title: string, data: any): ResourceEntity {
    const existing = this.get(tenantId, id);
    if (!existing) {
      throw new Error(`Recurso com ID '${id}' não encontrado para o tenant.`);
    }

    const now = new Date().toISOString();
    const newVersion = existing.version + 1;
    const serializedData = JSON.stringify(data ?? {});

    this.executeTransaction(() => {
      this.db.prepare(
        "UPDATE resources SET title = ?, data = ?, version = ?, updated_at = ? WHERE id = ? AND tenant_id = ?"
      ).run(title, serializedData, newVersion, now, id, tenantId);

      this.db.prepare(
        "INSERT INTO audit_wal_log (op, resource_id, tenant_id, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run("UPDATE", id, tenantId, serializedData, now);
    });

    return {
      id,
      tenantId,
      title,
      data,
      version: newVersion,
      createdAt: existing.createdAt,
      updatedAt: now
    };
  }

  public delete(tenantId: string, id: string): boolean {
    const existing = this.get(tenantId, id);
    if (!existing) return false;

    const now = new Date().toISOString();
    this.executeTransaction(() => {
      this.db.prepare("DELETE FROM resources WHERE id = ? AND tenant_id = ?").run(id, tenantId);
      this.db.prepare(
        "INSERT INTO audit_wal_log (op, resource_id, tenant_id, snapshot, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run("DELETE", id, tenantId, JSON.stringify(existing.data), now);
    });

    return true;
  }

  public listByTenant(tenantId: string): ResourceEntity[] {
    const rows = this.db.prepare(
      "SELECT id, tenant_id, title, data, version, created_at, updated_at FROM resources WHERE tenant_id = ? ORDER BY created_at DESC"
    ).all(tenantId) as any[];

    return rows.map(row => {
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(row.data);
      } catch {
        parsedData = row.data;
      }
      return {
        id: row.id,
        tenantId: row.tenant_id,
        title: row.title,
        data: parsedData,
        version: Number(row.version),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  }

  public count(): number {
    const row = this.db.prepare("SELECT COUNT(*) as c FROM resources").get() as any;
    return Number(row?.c || 0);
  }

  public getWalSize(): number {
    const row = this.db.prepare("SELECT COUNT(*) as c FROM audit_wal_log").get() as any;
    return Number(row?.c || 0);
  }

  public getWalLogs(limit = 100): WalLogEntry[] {
    const rows = this.db.prepare(
      "SELECT id, op, resource_id, tenant_id, snapshot, created_at FROM audit_wal_log ORDER BY id DESC LIMIT ?"
    ).all(limit) as any[];

    return rows.map(r => {
      let snap: any = null;
      try { snap = JSON.parse(r.snapshot); } catch { snap = r.snapshot; }
      return {
        id: Number(r.id),
        op: r.op,
        resourceId: r.resource_id,
        tenantId: r.tenant_id,
        snapshot: snap,
        createdAt: r.created_at
      };
    });
  }

  public executeTransaction<T>(fn: () => T): T {
    if (this.inTransaction) {
      return fn();
    }

    this.inTransaction = true;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // Rollback ignorado se já abortado
      }
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // Ignore if already closed
    }
  }
}
