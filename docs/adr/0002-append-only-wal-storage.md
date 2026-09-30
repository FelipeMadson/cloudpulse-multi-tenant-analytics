# ADR 0002: Persistência Durável com Write-Ahead Logging (WAL) e Sem Alocação Residual

- **Status:** Aceito (Accepted)
- **Data:** 2026-09-30
- **Autor:** Felipe Madison (@FelipeMadson)
- **Componente:** Storage Engine & Durabilidade

---

## 1. Contexto e Problema
Aplicações de alto desempenho necessitam de durabilidade em cenários de crash súbito ou perda de energia. Bancos de dados relacionais tradicionais ou servidores externos (PostgreSQL/Redis) introduzem latência de rede, custos operacionais e acoplamento desnecessário para processamento com garantias de atomicidade e ordenação local.

## 2. Decisão Arquitetural
Adotou-se o padrão de **Write-Ahead Logging (WAL)** em formato Append-Only com integridade assegurada via somas de verificação SHA-256 e escrita atômica com `fs.appendFileSync` e flush determinístico.

### Princípios do WAL do Cloudpulse Multi Tenant Analytics
1. **Append-Only Imutável:** Registros nunca são sobrescritos in-place; cada transação recebe um número de sequência monotonicamente crescente (`lsn`).
2. **Checksum por Entrada:** Cada registro contém seu próprio hash criptográfico, permitindo detectar corrupção de disco no momento da recuperação (*recovery replay*).
3. **Snapshot Compactado:** Criação periódica de snapshots de estado consolidado com rotação atômica de arquivos via `fs.renameSync`.

## 3. Consequências e Trade-offs

### Impactos Positivos
- Garantia de RPO (Recovery Point Objective) próximo a zero em caso de terminação abrupta do processo.
- Operações de escrita limitadas apenas pela velocidade de I/O sequencial do subsistema de armazenamento.
- Recuperação automática e determinística durante a inicialização do daemon.

### Desafios e Mitigações
- Crescimento do arquivo de log contínuo: mitigado com procedimento automatizado de compactação e expiração de logs arquivados.
