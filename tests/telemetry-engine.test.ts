import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  LockFreeRingBuffer,
  Float64RingBuffer,
  LinearRegressionLeakDetector
} from "../src/engines/telemetry/index.ts";

describe("Telemetry Engine Suite", () => {
  test("1. LockFreeRingBuffer opera com bitwise mask e FIFO", () => {
    const buf = new LockFreeRingBuffer(4, "overwrite");
    buf.push(1); buf.push(2); buf.push(3); buf.push(4); buf.push(5);
    assert.strictEqual(buf.size(), 4);
    assert.deepStrictEqual(buf.toArray(), [2, 3, 4, 5]);
  });

  test("2. LinearRegressionLeakDetector calcula Time-to-OOM sob vazamento real", () => {
    const detector = new LinearRegressionLeakDetector({
      minWindowSamples: 5,
      thresholdBytesPerSec: 1000,
      heapLimitBytes: 10000000
    });
    const t0 = 10000;
    for (let i = 0; i < 10; i++) {
      detector.recordSample(1000000 + i * 50000, t0 + i * 1000);
    }
    const analysis = detector.getAnalysis();
    assert.strictEqual(analysis.isLeaking, true);
    assert.ok(analysis.timeToOomSeconds !== null);
  });
});
