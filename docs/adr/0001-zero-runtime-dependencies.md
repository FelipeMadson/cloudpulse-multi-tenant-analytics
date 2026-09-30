# ADR 0001: Arquitetura com Zero Dependências de Terceiros no Núcleo de Execução

- **Status:** Aceito (Accepted)
- **Data:** 2026-09-30
- **Autor:** Felipe Madison (@FelipeMadson)
- **Componente:** Core Engine & Runtime

---

## 1. Contexto e Problema
Sistemas empresariais modernos frequentemente sofrem de inchaço de dependências (*supply chain bloat*), vulnerabilidades transitivas em pacotes NPM, quebra de contratos de API em atualizações de pacotes externos e overhead excessivo de cold-start.

Para o **Cloudpulse Multi Tenant Analytics** (`cloudpulse-multi-tenant-analytics`), é imperativo garantir:
1. **Segurança de Cadeia de Suprimentos:** Eliminação completa de riscos de injeção de dependências maliciosas (*malicious package takeover*).
2. **Determinismo Absoluto:** Execução idêntica através de qualquer ambiente Node.js LTS recente sem variação de ecossistema.
3. **Eficiência Máxima:** Zero custo de resolução de módulos dinâmicos e menor pegada de memória em repouso (< 25MB Heap).

## 2. Decisão Arquitetural
Decidiu-se que todo o núcleo de execução, protocolo HTTP, criptografia, persistência em disco e telemetria do **Cloudpulse Multi Tenant Analytics** deve ser implementado exclusivamente com as APIs nativas do Node.js (`node:http`, `node:crypto`, `node:fs`, `node:test`, `node:buffer`).

Não é permitida a inclusão de bibliotecas de terceiros como Express, Fastify, Lodash, Axios ou Dotenv no caminho crítico de execução do serviço.

## 3. Consequências e Trade-offs

### Impactos Positivos
- **Zero CVEs Transitivos:** Auditoria de segurança simplificada; zero alertas no Dependabot ou Snyk relacionados a pacotes externos.
- **Portabilidade Instantânea:** Instalação e execução com `node --experimental-strip-types` ou `node index.js` em sub-segundos, sem necessidade de `npm install` prévio para rodar.
- **Transparência de Código:** Todo o fluxo de execução é inspecionável diretamente no repositório.

### Desafios e Mitigações
- **Implementação Manual de Protocolos:** O roteamento de requisições, parsing de JSON e cabeçalhos HTTP foram desenvolvidos e cobertos por testes unitários rigorosos na suíte nativa `node:test`.
- **Governança:** A conformidade é checada de forma automatizada via CI através do script `scripts/verify-zero-deps.ts`.
