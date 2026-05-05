/**
 * Enrichments MFE - API Service
 * Service for enrichments and comments.
 * Connected to real Django backend via /api/enrichments/v1/ and /api/wiki/v1/comments/.
 */

import {
  BaseApiService,
  RestEndpointProtocol,
  RestProtocol,
} from '@cyberfabric/react';
import type {
  EnrichmentsResponse,
  CommentData,
  GitOpsLogResponse,
} from './types';
import { EnrichmentType } from './types';

export class EnrichmentsApiService extends BaseApiService {
  constructor() {
    const restProtocol = new RestProtocol({
      timeout: 30000,
      withCredentials: true,
    });
    const restEndpoints = new RestEndpointProtocol(restProtocol);

    super({ baseURL: '/api' }, restProtocol, restEndpoints);
  }

  // Enrichments (query by source_uri)
  async getEnrichments(
    sourceUri: string,
    options: { recursive?: boolean } = {},
  ): Promise<EnrichmentsResponse> {
    const params = new URLSearchParams({ source_uri: sourceUri });
    if (options.recursive) {
      params.set('recursive', 'true');
    }
    return this.protocol(RestProtocol).get<EnrichmentsResponse>(
      `/enrichments/v1/enrichments/?${params.toString()}`,
    );
  }

  // Enrichments filtered by type
  async getEnrichmentsByType(
    sourceUri: string,
    type: EnrichmentType,
  ): Promise<EnrichmentsResponse> {
    const params = new URLSearchParams({ source_uri: sourceUri, type });
    return this.protocol(RestProtocol).get<EnrichmentsResponse>(
      `/enrichments/v1/enrichments/?${params.toString()}`,
    );
  }

  // List available enrichment types
  async getEnrichmentTypes(): Promise<string[]> {
    const response = await this.protocol(RestProtocol).get<{ types: string[] }>(
      '/enrichments/v1/enrichments/types/',
    );
    return response.types;
  }

  /** Stream enrichments via NDJSON endpoint. Yields parsed events as they arrive.
   *  Falls back to the regular GET endpoint on network/parse errors. */
  async *streamEnrichments(
    sourceUri: string,
    signal?: AbortSignal,
  ): AsyncGenerator<{ type: string; message?: string; data?: EnrichmentsResponse }> {
    const url = `/api/enrichments/v1/enrichments/stream/?source_uri=${encodeURIComponent(sourceUri)}`;
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('cyberwiki_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const resp = await fetch(url, {
      credentials: 'include',
      headers,
      signal,
    });
    if (!resp.ok || !resp.body) return;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed);
        } catch { /* skip malformed lines */ }
      }
      if (done) break;
    }
  }

  // Comments CRUD (via wiki API)
  async listComments(sourceUri: string): Promise<CommentData[]> {
    return this.protocol(RestProtocol).get<CommentData[]>(
      `/wiki/v1/comments/?source_uri=${encodeURIComponent(sourceUri)}`
    );
  }

  /** All accessible comments (no source_uri filter). For the global "all
   *  comments" view. Backend returns root comments only; replies are nested. */
  async listAllComments(opts: { isResolved?: boolean } = {}): Promise<CommentData[]> {
    const params = new URLSearchParams();
    if (opts.isResolved !== undefined) {
      params.set('is_resolved', opts.isResolved ? 'true' : 'false');
    }
    const qs = params.toString();
    return this.protocol(RestProtocol).get<CommentData[]>(
      `/wiki/v1/comments/${qs ? `?${qs}` : ''}`,
    );
  }

  async createComment(payload: {
    source_uri: string;
    text: string;
    line_start?: number;
    line_end?: number;
    parent_comment?: string;
  }): Promise<CommentData> {
    return this.protocol(RestProtocol).post<CommentData, typeof payload>(
      '/wiki/v1/comments/', payload
    );
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.protocol(RestProtocol).delete(`/wiki/v1/comments/${commentId}/`);
  }

  async resolveComment(commentId: string): Promise<CommentData> {
    return this.protocol(RestProtocol).post<CommentData>(
      `/wiki/v1/comments/${commentId}/resolve/`
    );
  }

  async unresolveComment(commentId: string): Promise<CommentData> {
    return this.protocol(RestProtocol).post<CommentData>(
      `/wiki/v1/comments/${commentId}/unresolve/`
    );
  }

  // Git Ops Log
  async getGitOpsLog(limit?: number): Promise<GitOpsLogResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    const qs = params.toString();
    return this.protocol(RestProtocol).get<GitOpsLogResponse>(
      `/wiki/v1/git-ops-log/${qs ? `?${qs}` : ''}`,
    );
  }

  async clearGitOpsLog(): Promise<void> {
    await this.protocol(RestProtocol).delete('/wiki/v1/git-ops-log/');
  }
}
