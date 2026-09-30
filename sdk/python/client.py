"""
SDK Oficial Python para Cloudpulse Multi Tenant Analytics (cloudpulse-multi-tenant-analytics).
Desenvolvido com rigor de engenharia sênior por Felipe Madison (@FelipeMadson).
Construído utilizando exclusivamente a biblioteca padrão do Python (zero dependências externas).
"""

import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Union


class cloudpulsemultitenantanalyticsError(Exception):
    """Exceção base do SDK."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class AuthenticationError(cloudpulsemultitenantanalyticsError):
    """Erro de credenciais inválidas ou token expirado."""
    pass


class RateLimitError(cloudpulsemultitenantanalyticsError):
    """Erro de esgotamento de quota ou cota de requisições excedida."""
    pass


class cloudpulsemultitenantanalyticsClient:
    """Cliente oficial tipado para integração com Cloudpulse Multi Tenant Analytics."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:3000",
        auth_token: Optional[str] = None,
        tenant_id: str = "default-tenant",
        timeout: float = 10.0,
        max_retries: int = 3
    ):
        self.base_url = base_url.rstrip("/")
        self.auth_token = auth_token
        self.tenant_id = tenant_id
        self.timeout = timeout
        self.max_retries = max_retries

    def _request(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        custom_headers: Optional[Dict[str, str]] = None
    ) -> Union[Dict[str, Any], str]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {
            "Accept": "application/json",
            "User-Agent": f"cloudpulse-multi-tenant-analytics-sdk-python/1.0.0 (FelipeMadson)",
            "X-Tenant-ID": self.tenant_id
        }
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        if custom_headers:
            headers.update(custom_headers)

        data = None
        if payload is not None and method in ("POST", "PUT", "PATCH"):
            headers["Content-Type"] = "application/json; charset=utf-8"
            data = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    raw = resp.read().decode("utf-8")
                    content_type = resp.headers.get("Content-Type", "")
                    if "application/json" in content_type:
                        return json.loads(raw)
                    return raw

            except urllib.error.HTTPError as err:
                status = err.code
                body = err.read().decode("utf-8", errors="replace")
                if status == 401 or status == 403:
                    raise AuthenticationError(f"Autenticação rejeitada (HTTP {status}): {body}", status_code=status)
                if status == 429:
                    raise RateLimitError(f"Limite de requisições atingido (HTTP 429): {body}", status_code=status)
                if status >= 500 and attempt < self.max_retries:
                    backoff = min((2 ** attempt) + random.uniform(0.1, 0.5), 5.0)
                    time.sleep(backoff)
                    continue
                raise cloudpulsemultitenantanalyticsError(f"HTTP {status}: {body}", status_code=status)

            except (urllib.error.URLError, TimeoutError) as err:
                last_error = err
                if attempt < self.max_retries:
                    backoff = min((1.5 ** attempt) + random.uniform(0.1, 0.4), 4.0)
                    time.sleep(backoff)
                    continue

        raise cloudpulsemultitenantanalyticsError(f"Falha de rede após {self.max_retries} tentativas: {last_error}")

    def check_health(self) -> Dict[str, Any]:
        """Verifica a integridade operacional do serviço."""
        res = self._request("GET", "/health")
        return res if isinstance(res, dict) else {"status": "ok", "raw": res}

    def process_item(self, key: str, payload: Dict[str, Any], tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """Submete um item para processamento com isolamento de tenant."""
        headers = {"X-Tenant-ID": tenant_id} if tenant_id else None
        res = self._request("POST", "/api/v1/items", payload={"key": key, "payload": payload}, custom_headers=headers)
        return res if isinstance(res, dict) else {"raw": res}

    def verify_record(self, record_id: str) -> Dict[str, Any]:
        """Audita a integridade criptográfica de um registro."""
        res = self._request("GET", f"/api/v1/verify/{urllib.parse.quote(record_id)}")
        return res if isinstance(res, dict) else {"raw": res}

    def get_metrics(self) -> str:
        """Obtém as métricas de telemetria no formato Prometheus."""
        res = self._request("GET", "/metrics")
        return str(res)
