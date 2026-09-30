# ADR 0003: Higienização Criptográfica e Prevenção contra Timing Attacks

- **Status:** Aceito (Accepted)
- **Data:** 2026-09-30
- **Autor:** Felipe Madison (@FelipeMadson)
- **Componente:** Security & Cryptographic Vault

---

## 1. Contexto e Problema
A validação de tokens de autenticação, assinaturas HMAC e chaves criptográficas utilizando operadores de comparação comuns (`===` ou `==`) é vulnerável a **Timing Attacks**. Em ataques de canal lateral baseados em tempo, um atacante mede microssegundos na resposta do servidor para deduzir byte a byte o valor do segredo compartilhado.

## 2. Decisão Arquitetural
Estabeleceu-se que toda comparação de segredos, assinaturas e tokens no **Cloudpulse Multi Tenant Analytics** deve utilizar comparações de tempo constante via:
- `crypto.timingSafeEqual(bufferA, bufferB)` no runtime Node.js.
- Verificação de tamanhos de buffer e normalização prévia para prevenir vazamento de tamanho via branch prediction.
- Implementação no Web Playground através de XOR acumulador de tempo constante para execução no navegador.

## 3. Consequências e Trade-offs

### Impactos Positivos
- Imunidade comprovada contra ataques de temporização e vazamento de chaves simétricas.
- Conformidade com padrões de segurança OWASP ASVS Level 3.

### Desafios e Mitigações
- `crypto.timingSafeEqual` exige buffers com exatamente o mesmo comprimento (`byteLength`). Criou-se uma função auxiliar que calcula HMAC prévio em tempo constante para payloads de comprimento variável antes da comparação.
