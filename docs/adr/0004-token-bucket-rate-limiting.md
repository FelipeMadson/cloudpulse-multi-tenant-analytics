# ADR 0004: Controle de Vazão por Token-Bucket com Proteção contra DoS

- **Status:** Aceito (Accepted)
- **Data:** 2026-09-30
- **Autor:** Felipe Madison (@FelipeMadson)
- **Componente:** Traffic Management & Rate Limiter

---

## 1. Contexto e Problema
Sistemas expostos à internet precisam de mecanismos rigorosos de proteção contra rajadas abusivas de tráfego, Denial of Service (DoS) e exaustão de recursos computacionais por clientes maliciosos ou desconfigurados.

## 2. Decisão Arquitetural
Implementou-se o algoritmo de **Token Bucket com taxa de reabastecimento contínua (Continuous Refill Rate Limiter)**:
- Cada chave de cliente (endereço IP ou Token de API) possui um balde com capacidade fixa (`burstCapacity`) e taxa de recarga (`refillRatePerSec`).
- As requisições consomem tokens imediatamente. Caso o saldo seja insuficiente, a requisição é rejeitada com código HTTP `429 Too Many Requests` e cabeçalhos `Retry-After`.
- O cálculo do saldo de tokens é avaliado matematicamente por delta de timestamp (`now - lastRefill`), sem necessidade de timers periódicos em background que poderiam drenar a CPU do evento de loop.

## 3. Consequências e Trade-offs

### Impactos Positivos
- Absorção de rajadas legítimas de tráfego sem falsos positivos.
- Complexidade de tempo (O(1)) e zero timers ativos no Event Loop do Node.js.
- Métricas expostas via endpoint `/metrics` contabilizando rejeições e utilização do bucket.

### Desafios e Mitigações
- Limpeza de baldes de IPs inativos: estrutura com política LRU/TTL periódico para descarte de entradas sem atividade há mais de 10 minutos.
