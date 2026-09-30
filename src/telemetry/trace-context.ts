// =========================================================================
// W3C TraceContext & Distributed Correlation Parser
// Author: Felipe Madison (@FelipeMadson)
// =========================================================================

import crypto from "node:crypto";

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: string;
}

export class TraceContextManager {
  public static parseHeader(header?: string): SpanContext {
    if (!header || !header.startsWith("00-")) {
      return this.newTrace();
    }
    const parts = header.split("-");
    if (parts.length < 4 || parts[1].length !== 32 || parts[2].length !== 16) {
      return this.newTrace();
    }
    return {
      traceId: parts[1],
      spanId: parts[2],
      traceFlags: parts[3]
    };
  }

  public static newTrace(): SpanContext {
    return {
      traceId: crypto.randomBytes(16).toString("hex"),
      spanId: crypto.randomBytes(8).toString("hex"),
      traceFlags: "01"
    };
  }

  public static formatHeader(ctx: SpanContext): string {
    return `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags}`;
  }
}
