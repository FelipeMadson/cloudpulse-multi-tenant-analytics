export interface ResourceEntity {
  id: string;
  tenantId: string;
  title: string;
  data: any;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class StorageEngine {
  private store: Map<string, ResourceEntity> = new Map();
  private walLog: Array<{ op: "INSERT" | "UPDATE" | "DELETE"; id: string; timestamp: string }> = [];

  public insert(tenantId: string, id: string, title: string, data: any): ResourceEntity {
    if (this.store.has(id)) {
      throw new Error(`Recurso com ID '${id}' já existe.`);
    }
    const now = new Date().toISOString();
    const entity: ResourceEntity = {
      id,
      tenantId,
      title,
      data,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    this.store.set(id, entity);
    this.walLog.push({ op: "INSERT", id, timestamp: now });
    return entity;
  }

  public get(tenantId: string, id: string): ResourceEntity | null {
    const item = this.store.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  public listByTenant(tenantId: string): ResourceEntity[] {
    return Array.from(this.store.values()).filter(i => i.tenantId === tenantId);
  }

  public count(): number {
    return this.store.size;
  }

  public getWalSize(): number {
    return this.walLog.length;
  }
}
