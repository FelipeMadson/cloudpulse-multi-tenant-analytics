/**
 * Streaming Linear Regression Memory Leak Detector
 * 
 * Online O(1) Ordinary Least Squares (OLS) regression detector
 * predicting Out-Of-Memory (OOM) events in streaming time-series.
 * Calculates slope (m), intercept (b), and coefficient of determination (R^2).
 * 
 * Author: Felipe Madison (@FelipeMadson)
 * License: MIT
 */

import { LockFreeRingBuffer } from "./lock-free-ring-buffer.ts";

export type LeakConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface LeakAnalysis {
  isLeaking: boolean;
  slopeBytesPerSec: number;
  rSquared: number;
  currentHeapBytes: number;
  heapLimitBytes: number;
  timeToOomSeconds: number | null;
  confidence: LeakConfidence;
  sampleCount: number;
}

export interface LeakDetectorOptions {
  windowSize?: number;            // Capacity of sliding window (default: 64, power-of-two)
  thresholdBytesPerSec?: number;  // Minimum slope to trigger leak (default: 1024 bytes/sec = 1KB/s)
  minConfidenceRSquared?: number; // Minimum R^2 for high confidence (default: 0.85)
  heapLimitBytes?: number;        // Total heap limit before OOM (default: Node V8 limit or 1.4GB)
  minWindowSamples?: number;      // Minimum samples required before evaluation (default: 10)
}

export interface ILinearRegressionLeakDetector {
  recordSample(heapUsedBytes: number, timestampMs?: number): LeakAnalysis;
  getAnalysis(): LeakAnalysis;
  reset(): void;
}

interface MemorySample {
  x: number; // Elapsed seconds from t0
  y: number; // Heap used in bytes
}

export class LinearRegressionLeakDetector implements ILinearRegressionLeakDetector {
  private readonly options: Required<LeakDetectorOptions>;
  private buffer: LockFreeRingBuffer<MemorySample>;
  private baseTimestamp: number | null = null;
  private currentHeapBytes: number = 0;
  private sampleCounter: number = 0;

  // Running O(1) sum accumulators
  private sumX: number = 0;
  private sumY: number = 0;
  private sumXX: number = 0;
  private sumYY: number = 0;
  private sumXY: number = 0;

  constructor(options?: LeakDetectorOptions) {
    const defaultHeapLimit = 1400 * 1024 * 1024; // 1.4GB standard Node.js 64-bit heap limit
    this.options = {
      windowSize: options?.windowSize ?? 64,
      thresholdBytesPerSec: options?.thresholdBytesPerSec ?? 1024,
      minConfidenceRSquared: options?.minConfidenceRSquared ?? 0.85,
      heapLimitBytes: options?.heapLimitBytes ?? defaultHeapLimit,
      minWindowSamples: options?.minWindowSamples ?? 10
    };

    this.buffer = new LockFreeRingBuffer<MemorySample>(this.options.windowSize, 'overwrite');
  }

  public recordSample(heapUsedBytes: number, timestampMs: number = Date.now()): LeakAnalysis {
    if (this.baseTimestamp === null) {
      this.baseTimestamp = timestampMs;
    }

    const x = (timestampMs - this.baseTimestamp) / 1000;
    const y = heapUsedBytes;
    this.currentHeapBytes = heapUsedBytes;

    // Check if ring buffer is full prior to insertion to evict old sample in O(1)
    let evicted: MemorySample | undefined;
    if (this.buffer.isFull()) {
      evicted = this.buffer.peek();
    }

    this.buffer.push({ x, y });

    if (evicted) {
      this.sumX -= evicted.x;
      this.sumY -= evicted.y;
      this.sumXX -= evicted.x * evicted.x;
      this.sumYY -= evicted.y * evicted.y;
      this.sumXY -= evicted.x * evicted.y;
    }

    this.sumX += x;
    this.sumY += y;
    this.sumXX += x * x;
    this.sumYY += y * y;
    this.sumXY += x * y;

    this.sampleCounter++;
    // Recompute sums every 128 samples to guarantee zero floating-point accumulation drift
    if (this.sampleCounter % 128 === 0) {
      this.recomputeSums();
    }

    return this.getAnalysis();
  }

  public getAnalysis(): LeakAnalysis {
    const N = this.buffer.size();

    if (N < this.options.minWindowSamples) {
      return {
        isLeaking: false,
        slopeBytesPerSec: 0,
        rSquared: 0,
        currentHeapBytes: this.currentHeapBytes,
        heapLimitBytes: this.options.heapLimitBytes,
        timeToOomSeconds: null,
        confidence: 'NONE',
        sampleCount: N
      };
    }

    const denomX = N * this.sumXX - this.sumX * this.sumX;
    const denomY = N * this.sumYY - this.sumY * this.sumY;
    const numXY = N * this.sumXY - this.sumX * this.sumY;

    // Reject vertical lines or identical timestamps
    if (denomX <= 0) {
      return {
        isLeaking: false,
        slopeBytesPerSec: 0,
        rSquared: 0,
        currentHeapBytes: this.currentHeapBytes,
        heapLimitBytes: this.options.heapLimitBytes,
        timeToOomSeconds: null,
        confidence: 'NONE',
        sampleCount: N
      };
    }

    const slope = numXY / denomX;
    let rSquared = 0;
    if (denomY > 0) {
      rSquared = (numXY * numXY) / (denomX * denomY);
      rSquared = Math.max(0, Math.min(1, rSquared)); // Clamp to [0, 1]
    }

    const isLeaking = slope > this.options.thresholdBytesPerSec && 
                      rSquared >= this.options.minConfidenceRSquared;

    let timeToOom: number | null = null;
    if (slope > 0) {
      const headroom = Math.max(0, this.options.heapLimitBytes - this.currentHeapBytes);
      timeToOom = Math.round(headroom / slope);
    }

    let confidence: LeakConfidence = 'NONE';
    if (slope > 0) {
      if (rSquared >= 0.90 && N >= 10) {
        confidence = 'HIGH';
      } else if (rSquared >= 0.75) {
        confidence = 'MEDIUM';
      } else {
        confidence = 'LOW';
      }
    }

    return {
      isLeaking,
      slopeBytesPerSec: Math.round(slope * 100) / 100,
      rSquared: Math.round(rSquared * 10000) / 10000,
      currentHeapBytes: this.currentHeapBytes,
      heapLimitBytes: this.options.heapLimitBytes,
      timeToOomSeconds: timeToOom,
      confidence,
      sampleCount: N
    };
  }

  public reset(): void {
    this.buffer.clear();
    this.baseTimestamp = null;
    this.currentHeapBytes = 0;
    this.sampleCounter = 0;
    this.sumX = 0;
    this.sumY = 0;
    this.sumXX = 0;
    this.sumYY = 0;
    this.sumXY = 0;
  }

  private recomputeSums(): void {
    const items = this.buffer.toArray();
    this.sumX = 0;
    this.sumY = 0;
    this.sumXX = 0;
    this.sumYY = 0;
    this.sumXY = 0;
    for (const item of items) {
      this.sumX += item.x;
      this.sumY += item.y;
      this.sumXX += item.x * item.x;
      this.sumYY += item.y * item.y;
      this.sumXY += item.x * item.y;
    }
  }
}
