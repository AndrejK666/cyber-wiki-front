/**
 * Git Operations Log — API Service.
 *
 * Read-only debug surface mirroring the per-user ring-buffer on the backend.
 * Used by the Debug enrichments tab so users can inspect commit/PR
 * outcomes without grepping server logs.
 */

import {
  BaseApiService,
  RestProtocol,
  RestEndpointProtocol,
} from '@cyberfabric/react';
import type { GitOpsLogResponse } from './wikiTypes';

export class GitOpsLogApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({ timeout: 30000, withCredentials: true });
    const restEndpoints = new RestEndpointProtocol(restProtocol);
    super({ baseURL: '/api/wiki/v1' }, restProtocol, restEndpoints);
  }

  async list(params: { since?: number; limit?: number } = {}): Promise<GitOpsLogResponse> {
    const qs = new URLSearchParams();
    if (params.since !== undefined) qs.set('since', String(params.since));
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.protocol(RestProtocol).get<GitOpsLogResponse>(`/git-ops-log/${suffix}`);
  }

  async clear(): Promise<{ cleared: number }> {
    return this.protocol(RestProtocol).post<{ cleared: number }>(
      '/git-ops-log/clear/',
      {},
    );
  }
}
