# Modelo Arquitetural C4 — Cloudpulse Multi Tenant Analytics

> **Engenharia e Governança:** Felipe Madison (@FelipeMadson)  
> **Status:** Homologado para Produção  
> **Padrão:** C4 Model (Context, Containers, Components, Code)

Este documento descreve a topologia arquitetural e os contratos de design do **Cloudpulse Multi Tenant Analytics** (`cloudpulse-multi-tenant-analytics`), divididos em 4 níveis de abstração visual para equipes de engenharia, arquitetura de sistemas e operações.

---

## Nível 1: Diagrama de Contexto de Sistema (System Context)

O diagrama de contexto ilustra como o **Cloudpulse Multi Tenant Analytics** se posiciona no ecossistema de software, destacando os usuários humanos, clientes de API e integrações externas.

```mermaid
flowchart TD
  User["👤 Usuário / Engenheiro de Dados\n(Acesso Web & CLI)"]
  ExtClient["💻 Clientes Externos / Integrações\n(HTTP REST & Webhooks)"]
  Prometheus["📊 Prometheus / Grafana\n(Raspagem de Métricas)"]

  System["📦 Cloudpulse Multi Tenant Analytics\n[Software System]\nNúcleo autônomo com zero dependências de terceiros"]

  User -->|"Interage via Navegador ou CLI"| System
  ExtClient -->|"Envia requisições assinadas HMAC"| System
  Prometheus -->|"Raspa métricas em /metrics"| System
```

---

## Nível 2: Diagrama de Contêineres (Container Diagram)

Visão geral dos subsistemas de execução, protocolos e armazenamento em disco que compõem o contêiner do serviço.

```mermaid
flowchart TB
  subgraph Host["Ambiente de Execução (Node.js LTS / Docker)"]
    HttpServer["🌐 HTTP Gateway Server\n[Node.js / node:http]\nEscuta na porta 3000"]
    CoreEngine["⚙️ cloudpulsemultitenantanalytics Engine\n[TypeScript / Pure Logic]\nOrquestra o ciclo de vida e regras de negócio"]
    SecurityVault["🔐 Cryptographic Security Vault\n[node:crypto]\nValidação timing-safe, HMAC e hashes"]
    WalStorage["💾 Write-Ahead Log Storage\n[node:fs / Append-Only]\nPersistência durável e recuperação atômica"]
    MetricsCollector["📈 OpenMetrics Telemetry\n[Prometheus Native]\nExportador de latência, contadores e heap"]
  end

  Client["💻 Cliente Externo"] -->|"HTTP/1.1 REST (JSON)"| HttpServer
  HttpServer -->|"Roteia Requisições"| CoreEngine
  CoreEngine -->|"Valida Assinaturas & Tokens"| SecurityVault
  CoreEngine -->|"Persiste Transações"| WalStorage
  CoreEngine -->|"Registra Telemetria"| MetricsCollector
```

---

## Nível 3: Diagrama de Componentes (Component Diagram)

Detalhamento modular das classes e utilitários internos no subsistema do Cloudpulse Multi Tenant Analytics.

```mermaid
classDiagram
  class HttpServer {
    +start(port: number): Promise~void~
    +handleRequest(req, res): void
    +route(path: string, method: string): Handler
  }

  class cloudpulsemultitenantanalyticsEngine {
    +initialize(): Promise~void~
    +processTransaction(payload: any): TransactionResult
    +getState(): SystemState
    +recoverFromWal(): void
  }

  class RateLimiter {
    -tokens: Map~string, Bucket~
    +tryAcquire(clientId: string): boolean
    +getRemaining(clientId: string): number
  }

  class SecurityVault {
    +timingSafeVerify(a: Buffer, b: Buffer): boolean
    +computeHmac(data: string, secret: string): string
    +generateTraceId(): string
  }

  class WalManager {
    -logFilePath: string
    +appendEntry(entry: WalEntry): void
    +replayAll(): Array~WalEntry~
    +rotateSnapshot(): void
  }

  class MetricsRegistry {
    +incrementCounter(name: string): void
    +observeHistogram(name: string, value: number): void
    +formatOpenMetrics(): string
  }

  HttpServer --> RateLimiter : Valida Vazão
  HttpServer --> cloudpulsemultitenantanalyticsEngine : Despacha
  cloudpulsemultitenantanalyticsEngine --> SecurityVault : Criptografia
  cloudpulsemultitenantanalyticsEngine --> WalManager : Persistência
  cloudpulsemultitenantanalyticsEngine --> MetricsRegistry : Observabilidade
```

---

## Nível 4: Diagrama de Código e Sequência de Transação (Code / Sequence)

Fluxo atômico de uma requisição típica, desde o recebimento até a gravação no WAL e despacho da resposta.

```mermaid
sequenceDiagram
  autonumber
  actor Client as Cliente Externo
  participant Gate as HTTP Server
  participant Rate as Rate Limiter
  participant Sec as Security Vault
  participant Core as cloudpulsemultitenantanalytics
  participant Wal as WAL Storage
  participant Met as OpenMetrics

  Client->>Gate: POST /api/v1/resource (Headers: X-Signature, X-Trace-Id)
  Gate->>Rate: tryAcquire(clientIp)
  alt Rate Limit Ultrapassado
    Rate-->>Gate: Rejeitado (Sem tokens)
    Gate-->>Client: 429 Too Many Requests (Retry-After: 1)
  else Rate Limit Aprovado
    Rate-->>Gate: Aprovado
    Gate->>Sec: timingSafeVerify(signature, expectedHmac)
    alt Assinatura Inválida
      Sec-->>Gate: Falso
      Gate-->>Client: 401 Unauthorized
    else Assinatura Válida
      Sec-->>Gate: Verdadeiro
      Gate->>Core: execute(payload)
      Core->>Wal: appendEntry({ lsn, timestamp, payload, checksum })
      Wal-->>Core: ACK de Persistência
      Core->>Met: observeLatency(durationMs)
      Core-->>Gate: { status: "SUCCESS", id: "uuid", lsn: 42 }
      Gate-->>Client: 200 OK (Content-Type: application/json)
    end
  end
```

---

## Diretrizes de Resiliência e SLAs de Arquitetura

| Parâmetro | Alvo / Especificação |
| :--- | :--- |
| **Latência p95** | < 12ms sob carga nominal |
| **Latência p99** | < 45ms sob carga de pico |
| **Throughput por Instância** | > 4.500 req/s em hardware padrão de 2 vCPUs |
| **Uso de Memória Heap** | Estável em < 35MB sem vazamento em testes de 24h |
| **Recovery Point Objective (RPO)** | 0 transações confirmadas perdidas (WAL fsync) |
| **Recovery Time Objective (RTO)** | < 150ms na reinicialização com replay do WAL |
