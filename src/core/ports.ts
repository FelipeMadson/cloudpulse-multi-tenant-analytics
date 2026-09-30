// =========================================================================
// Hexagonal Architecture — Ports & Adapters
// Service: cloudpulse-multi-tenant-analytics
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

import { Result } from "./result.ts";
import type { TenantId, EntityId } from "./branded.ts";

export interface DomainEntity {
  id: EntityId;
  tenantId: TenantId;
  payload: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Inbound Port: Casos de uso acionados pelos adapters de entrada (REST/CLI)
export interface ExecuteCommandUseCase<TCommand, TResponse> {
  execute(command: TCommand): Promise<Result<TResponse, Error>>;
}

export interface ExecuteQueryUseCase<TQuery, TResponse> {
  query(params: TQuery): Promise<Result<TResponse, Error>>;
}

// Outbound Port: Interfaces de persistência e eventos (implementados por SQLite/Postgres/EventBus)
export interface EntityRepositoryPort {
  save(entity: DomainEntity): Promise<Result<void, Error>>;
  findById(id: EntityId, tenantId: TenantId): Promise<Result<DomainEntity | null, Error>>;
  listByTenant(tenantId: TenantId, limit?: number): Promise<Result<DomainEntity[], Error>>;
}

export interface DomainEventPublisherPort {
  publish(eventName: string, payload: Record<string, unknown>): Promise<Result<void, Error>>;
}
