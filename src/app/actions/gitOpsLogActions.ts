/**
 * Git Operations Log Actions
 * Fire-and-forget actions emitting events for the gitOpsLog effects to handle.
 */

import { eventBus } from '@cyberfabric/react';

export function loadGitOpsLog(limit = 100): void {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 100;
  eventBus.emit('wiki/gitOpsLog/load', { limit: safeLimit });
}

export function clearGitOpsLog(): void {
  eventBus.emit('wiki/gitOpsLog/clear');
}
