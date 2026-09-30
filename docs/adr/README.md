# Architecture Decision Records (ADRs) — Cloudpulse Multi Tenant Analytics

Este diretório contém o registro formal e imutável das decisões arquiteturais tomadas durante o ciclo de vida do projeto **Cloudpulse Multi Tenant Analytics** (`cloudpulse-multi-tenant-analytics`), estruturado e mantido por **Felipe Madison (@FelipeMadson)**.

Cada registro segue o padrão clássico de Michael Nygard, detalhando contexto, motivação, decisão formal, trade-offs e impactos de engenharia.

## Índice de Decisões

| ADR | Título | Status | Data | Componente |
| :--- | :--- | :--- | :--- | :--- |
| [ADR 0001](./0001-zero-runtime-dependencies.md) | Arquitetura com Zero Dependências de Terceiros no Núcleo de Execução | `Aceito` | 2026-09-30 | Core Engine & Runtime |
| [ADR 0002](./0002-append-only-wal-storage.md) | Persistência Durável com Write-Ahead Logging (WAL) e Sem Alocação Residual | `Aceito` | 2026-09-30 | Storage & Durabilidade |
| [ADR 0003](./0003-timing-safe-cryptographic-vault.md) | Higienização Criptográfica e Prevenção contra Timing Attacks | `Aceito` | 2026-09-30 | Security Vault |
| [ADR 0004](./0004-token-bucket-rate-limiting.md) | Controle de Vazão por Token-Bucket com Proteção contra DoS | `Aceito` | 2026-09-30 | Traffic Management |
| [ADR 0005](./0005-c4-model-and-event-driven-telemetry.md) | Modelagem C4 e Telemetria Nativa OpenMetrics/Prometheus | `Aceito` | 2026-09-30 | Observabilidade |

---

## Como Propor um Novo ADR
1. Copie o modelo base mantendo seções: Contexto, Decisão, Consequências.
2. Numere sequencialmente no formato `000X-nome-descritivo.md`.
3. Submeta para revisão via Pull Request com tag `docs(adr): ...`.
