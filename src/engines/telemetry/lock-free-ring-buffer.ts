/**
 * Lock-Free Circular Ring Buffer
 * 
 * High-performance, zero-allocation ring buffer for telemetry time-series,
 * latency percentiles, and high-frequency event streaming.
 * Uses power-of-two bitwise indexing for O(1) push/pop.
 * 
 * Author: Felipe Madison (@FelipeMadson)
 * License: MIT
 */

export type RingBufferPolicy = 'overwrite' | 'discard';

export interface RingBufferStats {
  capacity: number;
  size: number;
  totalPushed: number;
  totalDropped: number;
  policy: RingBufferPolicy;
}

export interface ILockFreeRingBuffer<T> {
  push(item: T): boolean;
  pop(): T | undefined;
  peek(): T | undefined;
  peekTail(): T | undefined;
  toArray(): T[];
  size(): number;
  isEmpty(): boolean;
  isFull(): boolean;
  clear(): void;
  getStats(): RingBufferStats;
}

/**
 * Calculates the next power of two greater than or equal to n.
 * Maximum capacity clamped to 2^30 (1,073,741,824) to maintain 32-bit SMI integer optimization in V8.
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n && p < 0x40000000) {
    p <<= 1;
  }
  return p;
}

export class LockFreeRingBuffer<T> implements ILockFreeRingBuffer<T> {
  public readonly capacity: number;
  public readonly policy: RingBufferPolicy;
  private readonly mask: number;
  private buffer: Array<T | undefined>;
  private head: number = 0; // Next write position
  private tail: number = 0; // Next read position
  private count: number = 0; // Current active element count
  private totalPushed: number = 0;
  private totalDropped: number = 0;

  constructor(requestedCapacity: number = 1024, policy: RingBufferPolicy = 'overwrite') {
    if (requestedCapacity <= 0 || !Number.isFinite(requestedCapacity)) {
      throw new Error("Ring buffer capacity must be a positive integer.");
    }
    this.capacity = nextPowerOfTwo(requestedCapacity);
    this.mask = this.capacity - 1;
    this.policy = policy;
    this.buffer = new Array<T | undefined>(this.capacity).fill(undefined);
  }

  public push(item: T): boolean {
    if (this.count === this.capacity) {
      if (this.policy === 'discard') {
        this.totalDropped++;
        return false;
      }
      // Overwrite policy: advance tail (drop oldest element)
      this.buffer[this.head] = item;
      this.head = (this.head + 1) & this.mask;
      this.tail = (this.tail + 1) & this.mask;
      this.totalPushed++;
      this.totalDropped++;
      return true;
    }

    this.buffer[this.head] = item;
    this.head = (this.head + 1) & this.mask;
    this.count++;
    this.totalPushed++;
    return true;
  }

  public pop(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }

    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined; // Clear reference for V8 GC
    this.tail = (this.tail + 1) & this.mask;
    this.count--;
    return item as T;
  }

  public peek(): T | undefined {
    if (this.count === 0) return undefined;
    return this.buffer[this.tail] as T;
  }

  public peekTail(): T | undefined {
    if (this.count === 0) return undefined;
    const lastIdx = (this.head - 1 + this.capacity) & this.mask;
    return this.buffer[lastIdx] as T;
  }

  public toArray(): T[] {
    const arr = new Array<T>(this.count);
    for (let i = 0; i < this.count; i++) {
      arr[i] = this.buffer[(this.tail + i) & this.mask] as T;
    }
    return arr;
  }

  public size(): number {
    return this.count;
  }

  public isEmpty(): boolean {
    return this.count === 0;
  }

  public isFull(): boolean {
    return this.count === this.capacity;
  }

  public clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  public getStats(): RingBufferStats {
    return {
      capacity: this.capacity,
      size: this.count,
      totalPushed: this.totalPushed,
      totalDropped: this.totalDropped,
      policy: this.policy
    };
  }
}

/**
 * High-performance Float64 ring buffer using typed arrays.
 * Guarantees zero heap allocation and zero object boxing for numeric metrics.
 */
export class Float64RingBuffer {
  public readonly capacity: number;
  public readonly policy: RingBufferPolicy;
  private readonly mask: number;
  private buffer: Float64Array;
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private totalPushed: number = 0;
  private totalDropped: number = 0;

  constructor(requestedCapacity: number = 1024, policy: RingBufferPolicy = 'overwrite') {
    this.capacity = nextPowerOfTwo(requestedCapacity);
    this.mask = this.capacity - 1;
    this.policy = policy;
    this.buffer = new Float64Array(this.capacity);
  }

  public push(value: number): boolean {
    if (this.count === this.capacity) {
      if (this.policy === 'discard') {
        this.totalDropped++;
        return false;
      }
      this.buffer[this.head] = value;
      this.head = (this.head + 1) & this.mask;
      this.tail = (this.tail + 1) & this.mask;
      this.totalPushed++;
      this.totalDropped++;
      return true;
    }

    this.buffer[this.head] = value;
    this.head = (this.head + 1) & this.mask;
    this.count++;
    this.totalPushed++;
    return true;
  }

  public pop(): number | undefined {
    if (this.count === 0) return undefined;
    const val = this.buffer[this.tail];
    this.tail = (this.tail + 1) & this.mask;
    this.count--;
    return val;
  }

  public toArray(): number[] {
    const result = new Array<number>(this.count);
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(this.tail + i) & this.mask];
    }
    return result;
  }

  public size(): number {
    return this.count;
  }

  public isFull(): boolean {
    return this.count === this.capacity;
  }

  public clear(): void {
    this.buffer.fill(0);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}
