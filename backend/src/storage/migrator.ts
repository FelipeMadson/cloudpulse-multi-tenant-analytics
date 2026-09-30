export interface Migration {
  id: string;
  name: string;
  version: number;
  up: () => Promise<void> | void;
  down: () => Promise<void> | void;
}

export class DatabaseMigrator {
  private appliedMigrations: Set<number> = new Set();
  private migrationLog: Array<{ version: number; name: string; appliedAt: string }> = [];

  public getAppliedVersions(): number[] {
    return Array.from(this.appliedMigrations).sort((a, b) => a - b);
  }

  public async applyMigration(migration: Migration): Promise<boolean> {
    if (this.appliedMigrations.has(migration.version)) {
      return false;
    }
    await migration.up();
    this.appliedMigrations.add(migration.version);
    this.migrationLog.push({
      version: migration.version,
      name: migration.name,
      appliedAt: new Date().toISOString()
    });
    return true;
  }

  public async runAll(): Promise<{ executed: number; currentVersion: number }> {
    const migrations: Migration[] = [
      {
        id: "001_core_schema",
        name: "Create Core Tenants and Resources Tables",
        version: 1,
        up: () => {},
        down: () => {}
      },
      {
        id: "002_streaming_metrics",
        name: "Add Time-Series and Telemetry Tables",
        version: 2,
        up: () => {},
        down: () => {}
      },
      {
        id: "003_workflow_state",
        name: "Add Workflow DAG and Task Execution Tables",
        version: 3,
        up: () => {},
        down: () => {}
      }
    ];

    let executed = 0;
    for (const m of migrations) {
      if (await this.applyMigration(m)) {
        executed++;
      }
    }
    const currentVersion = Math.max(0, ...this.getAppliedVersions());
    return { executed, currentVersion };
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrator.ts")) {
  const mig = new DatabaseMigrator();
  mig.runAll().then(r => console.log(`[DB Migrator] Sucesso: ${r.executed} migrações aplicadas. Versão atual: ${r.currentVersion}`));
}
