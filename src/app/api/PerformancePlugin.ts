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
 * onResponse does not carry the original request context, so we correlate
 * via a FIFO queue. Each request pipeline calls onRequest → HTTP → onResponse
 * for the same request, and the framework processes them in order, so
 * shifting the oldest entry pairs correctly.
 */
const pendingQueue: PendingTiming[] = [];

export class PerformancePlugin extends RestPlugin {
  onRequest(
    context: RestRequestContext,
  ): RestRequestContext | RestShortCircuitResponse {
    pendingQueue.push({
      method: context.method,
      url: context.url,
      start: performance.now(),
      timestamp: Date.now(),
    });
    return context;
  }

  onResponse(context: RestResponseContext): RestResponseContext {
    const timing = pendingQueue.shift();
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
