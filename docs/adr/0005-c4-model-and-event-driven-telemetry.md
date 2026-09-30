# ADR 0005: Modelagem C4 e Telemetria Nativa OpenMetrics/Prometheus

- **Status:** Aceito (Accepted)
- **Data:** 2026-09-30
- **Autor:** Felipe Madison (@FelipeMadson)
- **Componente:** Observabilidade & Governança

---

## 1. Contexto e Problema
A observabilidade é um requisito mandatório para operação de sistemas com SLAs estritos. Frequentemente, bibliotecas pesadas de APM adicionam sobrecarga e dependências excessivas. Além disso, a arquitetura precisa ser auto-explicativa para equipes multidisciplinares e engenheiros seniores.

## 2. Decisão Arquitetural
1. **Exposição Nativa OpenMetrics:** Implementação de endpoint `/metrics` compatível com o formato Prometheus/OpenMetrics padrão de mercado, exportando:
   - Contadores de requisições por rota e status HTTP (`http_requests_total`).
   - Histogramas de latência de processamento (`http_request_duration_seconds`).
   - Indicadores de integridade do storage WAL (`wal_records_total`, `wal_bytes_written`).
   - Métricas de processo (consumo de heap, RSS e uptime).
2. **Modelagem C4:** Documentação viva de Nível 1 a Nível 4 em diagramas Mermaid versionados no próprio repositório (`docs/architecture/c4-model.md`).

## 3. Consequências e Trade-offs

### Impactos Positivos
- Prontidão imediata para raspagem via Grafana/Prometheus em clusters Kubernetes ou Docker.
- Comunicação visual clara entre equipes através dos diagramas C4 padronizados.
- Zero dependência externa para coleta e cálculo das métricas.
