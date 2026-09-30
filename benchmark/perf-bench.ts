/**
 * Benchmark de Performance & Throughput
 * Executa mutações em lote e afere percentis P50, P95, P99
 */
import { SaasPlatformServer } from "../backend/src/server.ts";

async function runBenchmark() {
  console.log("⚡ Executando Benchmark de Vazão para ${ctx.title}...");
  const server = new SaasPlatformServer();
  const iterations = 1000;
  const latencies: number[] = [];
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    server.storage.insert("tenant-enterprise-acme", "bench_" + i, "Bench Item", { i });
    server.streaming.ingest({
      id: "evt_bench_" + i,
      tenantId: "tenant-enterprise-acme",
      source: "bench",
      eventType: "throughput",
      timestamp: Date.now(),
      durationMs: 4,
      statusCode: 200
    });
    latencies.push(performance.now() - t0);
  }

  const durationSec = (performance.now() - start) / 1000;
  const opsPerSec = Math.round(iterations / Math.max(durationSec, 0.001));

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log("\n=======================================================");
  console.log("📊 RESULTADO DO BENCHMARK CORPORATIVO");
  console.log("=======================================================");
  console.log("Operações : " + iterations + " transações");
  console.log("Tempo     : " + Math.round(durationSec * 1000) + " ms");
  console.log("Vazão     : " + opsPerSec + " ops/s");
  console.log("P50       : " + p50.toFixed(4) + " ms");
  console.log("P95       : " + p95.toFixed(4) + " ms");
  console.log("P99       : " + p99.toFixed(4) + " ms");
  console.log("=======================================================\n");
}

runBenchmark();
