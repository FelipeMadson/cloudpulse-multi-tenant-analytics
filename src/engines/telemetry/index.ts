/**
 * Unified Telemetry & Observability Engine Reference Exports
 * 
 * Author: Felipe Madison (@FelipeMadson)
 * License: MIT
 */

export {
  LockFreeRingBuffer,
  Float64RingBuffer,
  nextPowerOfTwo,
  type RingBufferPolicy,
  type RingBufferStats,
  type ILockFreeRingBuffer
} from "./lock-free-ring-buffer.ts";

export {
  LinearRegressionLeakDetector,
  type LeakConfidence,
  type LeakAnalysis,
  type LeakDetectorOptions,
  type ILinearRegressionLeakDetector
} from "./linear-regression-detector.ts";
