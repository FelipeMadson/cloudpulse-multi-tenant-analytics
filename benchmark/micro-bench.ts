// =========================================================================
// High-Precision Micro-Benchmarks — cloudpulse-multi-tenant-analytics
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

import { performance } from "node:perf_hooks";

export async function runMicroBenchmark(
  name: string,
  iterations: number,
  fn: () => void | Promise<void>
): Promise<{ opsPerSecond: number; p50: number; p95: number; p99: number; totalDurationMs: number }> {
  const durations: number[] = [];

  // Warmup (100 iterações para otimização JIT V8)
  for (let w = 0; w < Math.min(100, iterations); w++) {
    await fn();
  }

  const overallStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    durations.push(performance.now() - start);
  }
  const overallDuration = performance.now() - overallStart;

  durations.sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.50)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];
  const opsPerSecond = Math.round((iterations / (overallDuration / 1000)));

  return { opsPerSecond, p50, p95, p99, totalDurationMs: overallDuration };
}

async function main() {
  console.log("⚡ INICIANDO MICRO-BENCHMARKS DE ALTA PRECISÃO: cloudpulse-multi-tenant-analytics\n");

  const result = await runMicroBenchmark("Throughput de Operação em Memória", 10000, () => {
    // Operação leve determinística simulada
    const x = Math.sqrt(Math.random() * 1000000);
  });

  console.log("📊 RESULTADOS DO BENCHMARK:");
  console.log(`   - Vazão / Throughput  : ${result.opsPerSecond.toLocaleString()} ops/sec`);
  console.log(`   - Latência Mediana p50: ${result.p50.toFixed(4)} ms`);
  console.log(`   - Latência Cauda p95  : ${result.p95.toFixed(4)} ms`);
  console.log(`   - Latência Crítica p99: ${result.p99.toFixed(4)} ms`);
  console.log(`   - Duração Total       : ${result.totalDurationMs.toFixed(2)} ms\n`);
}

if (process.argv[1]?.endsWith("micro-bench.ts")) {
  main().catch(console.error);
}
