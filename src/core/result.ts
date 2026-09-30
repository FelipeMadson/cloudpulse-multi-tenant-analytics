// =========================================================================
// Railway-Oriented Programming (ROP) — Result Monad
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

export class Result<T, E = Error> {
  private constructor(
    private readonly success: boolean,
    private readonly value?: T,
    private readonly errorVal?: E
  ) {}

  public static ok<U, F = Error>(value: U): Result<U, F> {
    return new Result<U, F>(true, value, undefined);
  }

  public static fail<U, F = Error>(error: F): Result<U, F> {
    return new Result<U, F>(false, undefined, error);
  }

  public isOk(): boolean {
    return this.success;
  }

  public isErr(): boolean {
    return !this.success;
  }

  public unwrap(): T {
    if (!this.success) {
      throw new Error(`Tentativa de unwrap em Result.fail: ${String(this.errorVal)}`);
    }
    return this.value as T;
  }

  public unwrapOr(fallback: T): T {
    return this.success ? (this.value as T) : fallback;
  }

  public unwrapErr(): E {
    if (this.success) {
      throw new Error("Tentativa de unwrapErr em Result.ok");
    }
    return this.errorVal as E;
  }

  public map<U>(fn: (val: T) => U): Result<U, E> {
    if (this.success) {
      return Result.ok<U, E>(fn(this.value as T));
    }
    return Result.fail<U, E>(this.errorVal as E);
  }

  public mapErr<F>(fn: (err: E) => F): Result<T, F> {
    if (!this.success) {
      return Result.fail<T, F>(fn(this.errorVal as E));
    }
    return Result.ok<T, F>(this.value as T);
  }

  public flatMap<U>(fn: (val: T) => Result<U, E>): Result<U, E> {
    if (this.success) {
      return fn(this.value as T);
    }
    return Result.fail<U, E>(this.errorVal as E);
  }

  public match<R>(onOk: (val: T) => R, onErr: (err: E) => R): R {
    return this.success ? onOk(this.value as T) : onErr(this.errorVal as E);
  }
}
