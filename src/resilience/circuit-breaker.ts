// =========================================================================
// Enterprise Circuit Breaker Pattern (Sliding Window)
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThresholdPercentage?: number; // Ex: 50%
  minimumRequests?: number;            // Ex: 5 requisições antes de avaliar
  resetTimeoutMs?: number;             // Ex: 5000ms antes de tentar HALF_OPEN
  windowSize?: number;                 // Ex: 10 amostras deslizantes
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private window: boolean[] = []; // true = sucesso, false = falha
  private nextAttemptTime: number = 0;
  private readonly threshold: number;
  private readonly minRequests: number;
  private readonly resetTimeoutMs: number;
  private readonly windowSize: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.failureThresholdPercentage || 50;
    this.minRequests = options.minimumRequests || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 5000;
    this.windowSize = options.windowSize || 10;
  }

  public getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() >= this.nextAttemptTime) {
      this.state = "HALF_OPEN";
    }
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      if (fallback) return fallback();
      throw new Error("CircuitBreaker: Circuito OPEN. Requisição rejeitada preventivamente.");
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      if (fallback) return fallback();
      throw err;
    }
  }

  private recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.window = [];
    }
    this.pushSample(true);
  }

  private recordFailure(): void {
    this.pushSample(false);
    if (this.state === "HALF_OPEN") {
      this.trip();
      return;
    }

    if (this.window.length >= this.minRequests) {
      const failures = this.window.filter(s => !s).length;
      const failureRate = (failures / this.window.length) * 100;
      if (failureRate >= this.threshold) {
        this.trip();
      }
    }
  }

  private pushSample(success: boolean): void {
    this.window.push(success);
    if (this.window.length > this.windowSize) {
      this.window.shift();
    }
  }

  private trip(): void {
    this.state = "OPEN";
    this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
  }

  public reset(): void {
    this.state = "CLOSED";
    this.window = [];
    this.nextAttemptTime = 0;
  }
}
