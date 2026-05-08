/**
 * Host Actions — proxy emitters for host-owned events that MFE components use.
 *
 * These emit events whose effects live in the host app. The MFE only emits;
 * the host's effects handle the actual API calls. This keeps the MFE loosely
 * coupled from the draft-change and user-branch domains.
 */

import { eventBus } from '@cyberfabric/react';

// Draft change events (host-owned)
export function discardDraft(changeId: string): void {
  eventBus.emit('wiki/draft/discard', { changeId });
}

export function commitDrafts(changeIds: string[], commitMessage?: string): void {
  eventBus.emit('wiki/draft/commit', { changeIds, commitMessage });
}

// User branch events (host-owned)
export function unstageBranch(spaceId: string, branchId?: string): void {
  eventBus.emit('wiki/branch/unstage', { spaceId, branchId });
}

export function createPullRequest(payload: {
  spaceId: string;
  branchId?: string;
  title?: string;
  description?: string;
}): void {
  eventBus.emit('wiki/pr/create', payload);
}
