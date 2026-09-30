# RFC-0003: API Contracts, Wire Specification & Backward Compatibility

- **Status**: Accepted
- **Author**: Felipe Madison (@FelipeMadson)
- **Scope**: `@felipemadson/cloudpulse-multi-tenant-analytics`
- **Created**: 2026-09-30
- **Version**: 1.1.0

---

## 1. API Contract Overview

The service exposes standardized OpenAPI 3.1 contracts with strictly typed schemas and W3C TraceContext headers (`traceparent`, `tracestate`).

## 2. Wire Endpoints

### 2.1 Health Probe & Diagnostics
- **Path**: `/health`
- **Method**: `GET`
- **Response**: `200 OK`
  ```json
  {
    "status": "HEALTHY",
    "version": "1.1.0",
    "uptimeSeconds": 1420,
    "checks": {
      "circuitBreaker": "CLOSED",
      "tokenBucket": "REPLENISHED"
    }
  }
  ```

### 2.2 Telemetry Exposition
- **Path**: `/metrics`
- **Method**: `GET`
- **Content-Type**: `text/plain; version=0.0.4`
- **Metrics**: `http_requests_total`, `http_request_duration_seconds{quantile="0.99"}`, `process_resident_memory_bytes`.

## 3. Backward Compatibility & Deprecation Policy

1. All breaking schema changes require a minimum 90-day RFC review window and increment of the major SemVer version.
2. Inbound endpoints guarantee forward compatibility with old client envelopes using non-destructive property extraction.
