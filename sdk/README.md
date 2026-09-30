# SDKs de Cliente Poliglota — Cloudpulse Multi Tenant Analytics

SDKs oficiais desenvolvidos para integração de sistemas com o **Cloudpulse Multi Tenant Analytics** (`cloudpulse-multi-tenant-analytics`), projetados sob os mais altos padrões de engenharia de software corporativa por **Felipe Madison (@FelipeMadson)**.

---

## 🚀 TypeScript / Node.js SDK

### Instalação / Importação
O SDK foi projetado com **zero dependências externas de runtime**, utilizando as APIs nativas do Node.js 22 LTS / navegadores modernos.

```typescript
import { cloudpulsemultitenantanalyticsClient } from "./sdk/ts/client.ts";

const client = new cloudpulsemultitenantanalyticsClient({
  baseUrl: "http://127.0.0.1:3000",
  authToken: "sec_token_enterprise_9918",
  tenantId: "acme-corp"
});

// Verificação de saúde operacional
const health = await client.checkHealth();
console.log("Status:", health.status);

// Processamento determinístico de registro
const result = await client.processItem("order-789", {
  amount: 2500.00,
  currency: "BRL"
});
console.log("Hash de integridade:", result.hash);

// Verificação criptográfica de integridade
const audit = await client.verifyRecord(result.id);
console.log("Registro verificado:", audit.verified);
```

---

## 🐍 Python SDK

### Instalação / Importação
100% em conformidade com Python 3.10+, utilizando estritamente a biblioteca padrão (`urllib.request`), sem requerer `pip install requests`.

```python
from sdk.python.client import cloudpulsemultitenantanalyticsClient

client = cloudpulsemultitenantanalyticsClient(
    base_url="http://127.0.0.1:3000",
    auth_token="sec_token_enterprise_9918",
    tenant_id="acme-corp"
)

# Verificação de saúde
health = client.check_health()
print(f"Status: {health}")

# Processamento de item
res = client.process_item("sensor-alpha", {"temperature": 23.8, "pressure": 1013.25})
print(f"Item processado com ID: {res.get('id')}")

# Métricas Prometheus
metrics = client.get_metrics()
print("Métricas expostas:")
print(metrics[:200])
```

---

## 🛡️ Garantias de Engenharia
- **Retry Exponencial com Jitter:** Resiliência automática contra indisponibilidade transitória de rede.
- **Isolamento de Tenant:** Cabeçalhos determinísticos `X-Tenant-ID` para garantia de zero vazamento cruzado.
- **Tipagem Estrita:** Tipos completos TypeScript e type hints Python com docstrings PEP 257.
