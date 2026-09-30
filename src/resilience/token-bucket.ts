// =========================================================================
// Token Bucket Rate Limiter
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillTimestamp: number;
  private readonly capacity: number;
  private readonly refillRatePerSecond: number;

  constructor(capacity: number = 20, refillRatePerSecond: number = 10) {
    this.capacity = capacity;
    this.refillRatePerSecond = refillRatePerSecond;
    this.tokens = capacity;
    this.lastRefillTimestamp = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRatePerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTimestamp = now;
  }

  public tryConsume(tokensRequested: number = 1): boolean {
    this.refill();
    if (this.tokens >= tokensRequested) {
      this.tokens -= tokensRequested;
      return true;
    }
    return false;
  }

  public async acquireOrWait(tokensRequested: number = 1, maxWaitMs: number = 2000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime <= maxWaitMs) {
      if (this.tryConsume(tokensRequested)) {
        return true;
      }
      await new Promise(r => setTimeout(r, 25));
    }
    return false;
  }

  public getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
