import { DatabaseSync } from "node:sqlite";

export interface Migration {
  id: string;
  name: string;
  version: number;
  up: (db: DatabaseSync) => void;
  down: (db: DatabaseSync) => void;
}

export class DatabaseMigrator {
  private db: DatabaseSync;

  constructor(db?: DatabaseSync) {
    if (db) {
      this.db = db;
    } else {
      this.db = new DatabaseSync(":memory:");
    }
    this.ensureMigrationTable();
  }

  private ensureMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  public getAppliedVersions(): number[] {
    this.ensureMigrationTable();
    const rows = this.db.prepare("SELECT version FROM schema_migrations ORDER BY version ASC").all() as any[];
    return rows.map(r => Number(r.version));
  }

  public applyMigration(migration: Migration): boolean {
    const applied = this.getAppliedVersions();
    if (applied.includes(migration.version)) {
      return false;
    }

    this.db.exec("BEGIN IMMEDIATE");
    try {
      migration.up(this.db);
      this.db.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
      ).run(migration.version, migration.name, new Date().toISOString());
      this.db.exec("COMMIT");
      return true;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {}
      throw err;
    }
  }

  public async runAll(): Promise<{ executed: number; currentVersion: number }> {
    const migrations: Migration[] = [
      {
        id: "001_core_schema",
        name: "Create Core Tenants, Resources and WAL Tables",
        version: 1,
        up: (db) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS tenants (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              tier TEXT NOT NULL,
              quota_per_minute INTEGER NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS resources (
              id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL,
              title TEXT NOT NULL,
              data TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit_wal_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              op TEXT NOT NULL,
              resource_id TEXT NOT NULL,
              tenant_id TEXT NOT NULL,
              snapshot TEXT,
              created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_resources_tenant ON resources(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_wal_tenant ON audit_wal_log(tenant_id);
          `);
        },
        down: (db) => {
          db.exec(`
            DROP TABLE IF EXISTS audit_wal_log;
            DROP TABLE IF EXISTS resources;
            DROP TABLE IF EXISTS tenants;
          `);
        }
      },
      {
        id: "002_auth_and_webhooks",
        name: "Add API Keys, Auth Audit, and Webhooks Tables",
        version: 2,
        up: (db) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS api_keys (
              key_id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL,
              role TEXT NOT NULL,
              secret_hash TEXT NOT NULL,
              revoked INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              last_used_at TEXT,
              expires_at TEXT,
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit_auth_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              key_id TEXT,
              tenant_id TEXT NOT NULL,
              action TEXT NOT NULL,
              success INTEGER NOT NULL,
              detail TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS webhook_events (
              id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL,
              topic TEXT NOT NULL,
              payload TEXT NOT NULL,
              target_url TEXT NOT NULL,
              secret TEXT NOT NULL,
              attempts INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at TEXT NOT NULL,
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS webhook_receipts (
              id TEXT PRIMARY KEY,
              event_id TEXT NOT NULL,
              status_code INTEGER NOT NULL,
              response_body TEXT,
              signature TEXT NOT NULL,
              duration_ms INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (event_id) REFERENCES webhook_events(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_apikeys_tenant ON api_keys(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_events(status);
          `);
        },
        down: (db) => {
          db.exec(`
            DROP TABLE IF EXISTS webhook_receipts;
            DROP TABLE IF EXISTS webhook_events;
            DROP TABLE IF EXISTS audit_auth_log;
            DROP TABLE IF EXISTS api_keys;
          `);
        }
      },
      {
        id: "003_streaming_and_workflows",
        name: "Add Workflow DAG and Telemetry Time-Series Tables",
        version: 3,
        up: (db) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS workflow_executions (
              execution_id TEXT PRIMARY KEY,
              workflow_name TEXT NOT NULL,
              status TEXT NOT NULL,
              started_at TEXT NOT NULL,
              finished_at TEXT,
              steps_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS time_series_events (
              id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL,
              source TEXT NOT NULL,
              event_type TEXT NOT NULL,
              timestamp INTEGER NOT NULL,
              duration_ms REAL NOT NULL,
              status_code INTEGER NOT NULL,
              data_json TEXT,
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_time_series_tenant_time ON time_series_events(tenant_id, timestamp);
          `);
        },
        down: (db) => {
          db.exec(`
            DROP TABLE IF EXISTS time_series_events;
            DROP TABLE IF EXISTS workflow_executions;
          `);
        }
      }
    ];

    let executed = 0;
    for (const m of migrations) {
      if (this.applyMigration(m)) {
        executed++;
      }
    }
    const applied = this.getAppliedVersions();
    const currentVersion = applied.length > 0 ? Math.max(...applied) : 0;
    return { executed, currentVersion };
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrator.ts")) {
  const mig = new DatabaseMigrator();
  mig.runAll().then(r => console.log(`[DB Migrator] Sucesso: ${r.executed} migrações aplicadas. Versão atual: ${r.currentVersion}`));
}
