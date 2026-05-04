/**
 * PerformancePlugin — REST protocol plugin that automatically records every
 * API request into the in-memory performanceTracker metrics array.
 *
 * Registered globally in initApp.ts so all services are instrumented.
 */

import { RestPlugin } from '@cyberfabric/react';
import type { RestRequestContext, RestResponseContext, RestShortCircuitResponse } from '@cyberfabric/react';
import { pushMetric } from '@/app/lib/performanceTracker';

interface PendingTiming {
  method: string;
  url: string;
  start: number;
  timestamp: number;
}

/**
 * onResponse does not carry the original request URL/method, so we inject
 * a monotonic sequence id into a custom request header and read it back
 * from the response headers. If the header is stripped or missing we fall
 * back to best-effort FIFO.
 */
let nextSeqId = 1;
const SEQ_HEADER = 'x-perf-seq';
const pendingMap = new Map<number, PendingTiming>();

export class PerformancePlugin extends RestPlugin {
  onRequest(
    context: RestRequestContext,
  ): RestRequestContext | RestShortCircuitResponse {
    const id = nextSeqId++;
    pendingMap.set(id, {
      method: context.method,
      url: context.url,
      start: performance.now(),
      timestamp: Date.now(),
    });
    return {
      ...context,
      headers: { ...context.headers, [SEQ_HEADER]: String(id) },
    };
  }

  onResponse(context: RestResponseContext): RestResponseContext {
    const seqRaw = context.headers?.[SEQ_HEADER];
    let timing: PendingTiming | undefined;
    if (seqRaw) {
      const id = Number(seqRaw);
      timing = pendingMap.get(id);
      pendingMap.delete(id);
    } else {
      // Fallback: take the oldest entry (legacy FIFO).
      const firstKey = pendingMap.keys().next().value;
      if (firstKey !== undefined) {
        timing = pendingMap.get(firstKey);
        pendingMap.delete(firstKey);
      }
    }
    if (!timing) return context;

    const duration = performance.now() - timing.start;
    let dataSize: number | undefined;
    if (context.data !== undefined && context.data !== null) {
      try {
        const json = JSON.stringify(context.data);
        dataSize = new Blob([json]).size;
      } catch {
        // non-serialisable
      }
    }

    pushMetric({
      operation: `${timing.method} ${context.status}`,
      duration,
      dataSize,
      timestamp: timing.timestamp,
      url: timing.url,
    });

    return context;
  }
}
