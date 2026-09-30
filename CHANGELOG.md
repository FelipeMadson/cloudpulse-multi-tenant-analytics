# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-09-30

### Adicionado
- **Multi-Tenancy Engine**: Isolamento estrito de dados, quotas dinâmicas e rate limiting por minuto.
- **Autenticação HMAC & RBAC**: Tokens criptográficos com verificação timing-safe (`timingSafeEqual`).
- **Storage Transacional WAL**: Persistência determinística com Write-Ahead Logging e integridade ACID.
- **Database Migrations & Seeders**: Motor de migrações sequenciadas e seeder de demonstração corporativo.
- **Webhook Gateway**: Despachador de eventos assíncrono com retentativas com exponential backoff e assinatura HMAC-SHA256.
- **Streaming & Analytics Hub**: Ingestão de telemetria com cálculo de percentis (P50, P95, P99) em janelas de tempo deslizantes.
- **Zero-Trust Cryptographic Vault**: Armazenamento seguro de segredos com grants efêmeros e cadeia de auditoria Merkle.
- **Workflow DAG Orchestrator**: Motor de orquestração de tarefas assíncronas com resolução de dependências e compensação de falhas.
- **Documentação OpenAPI 3.0 & Scalar Embutida**: Rota interativa `/docs` e especificação dinâmica em `/openapi.json`.
- **Telemetria Prometheus**: Exportador nativo de métricas em `/metrics` e sondas de saúde em `/health`.
- **CI/CD Multi-Plataforma**: Workflow do GitHub Actions com matriz cruzada Ubuntu + Windows e Node 22 + 24 com verificação SAST.

### Segurança
- Certificação de 0 vulnerabilidades em análise estática SAST.
- Imunidade contra ataques de canal lateral (*timing attacks*) no processo de autenticação.
- Proteção anti-vazamento de credenciais em logs e saídas de telemetria.

---
**Autor:** Felipe Madison ([@FelipeMadson](https://github.com/FelipeMadson))
