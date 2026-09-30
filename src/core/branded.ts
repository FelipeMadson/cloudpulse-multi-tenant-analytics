// =========================================================================
// Defensive Typing — Branded / Nominal Types
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

export type Brand<K, T> = K & { readonly __brand: T };

export type TenantId = Brand<string, "TenantId">;
export type UserId = Brand<string, "UserId">;
export type EntityId = Brand<string, "EntityId">;
export type CorrelationId = Brand<string, "CorrelationId">;

export class TypeBrander {
  public static tenantId(val: string): TenantId {
    if (!val || val.trim().length === 0) throw new Error("TenantId não pode ser vazio");
    return val.trim() as TenantId;
  }

  public static userId(val: string): UserId {
    if (!val || val.trim().length === 0) throw new Error("UserId não pode ser vazio");
    return val.trim() as UserId;
  }

  public static entityId(val: string): EntityId {
    if (!val || val.trim().length === 0) throw new Error("EntityId não pode ser vazio");
    return val.trim() as EntityId;
  }

  public static correlationId(val: string): CorrelationId {
    if (!val || val.trim().length === 0) throw new Error("CorrelationId não pode ser vazio");
    return val.trim() as CorrelationId;
  }
}
