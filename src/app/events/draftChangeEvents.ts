/**
 * Draft Change Events
 *
 * Event type declarations for draft-change domain (user edits not yet committed).
 * Per FR cpt-cyberwiki-fr-save-commit / cpt-cyberwiki-fr-pending-changes.
 */

import '@cyberfabric/react';
import type {
  DraftChange,
  DraftChangeListItem,
  EditChangeType,
  PRStatus,
} from '@/app/api';

declare module '@cyberfabric/react' {
  interface EventPayloadMap {
    /** Load drafts list (optionally filtered by space) */
    'wiki/drafts/load': { spaceId?: string };
    /** Drafts list loaded */
    'wiki/drafts/loaded': { spaceId?: string; drafts: DraftChangeListItem[] };

    /** Load a single draft by id */
    'wiki/draft/get': { changeId: string };
    /** Single draft loaded */
    'wiki/draft/got': { draft: DraftChange };

    /** Save (create or upsert) a draft */
    'wiki/draft/save': {
      spaceId: string;
      filePath: string;
      originalContent: string;
      modifiedContent: string;
      changeType: EditChangeType;
      description: string;
    };
    /** Draft saved. spaceId and filePath echo the request so subscribers can
     *  optimistically update per-space state without waiting for a follow-up
     *  loadDrafts round-trip (which the FileViewer's Commit button needs). */
    'wiki/draft/saved': {
      changeId: string;
      created: boolean;
      spaceId: string;
      filePath: string;
    };

    /** Discard a draft change */
    'wiki/draft/discard': { changeId: string };
    /** Draft change discarded */
    'wiki/draft/discarded': { changeId: string };

    /** Commit selected drafts to git */
    'wiki/draft/commit': { changeIds: string[]; commitMessage?: string };
    /** Drafts committed */
    'wiki/draft/committed': {
      commitSha: string | null;
      branchName: string;
      filesCommitted: number;
      spaceId: string;
      spaceSlug: string;
      /** Populated when the commit also auto-opened (or returned the existing)
       *  PR for the branch. Null when no PR was created. */
      pr?: { prId: string; prUrl: string } | null;
      /** Reason the auto-PR step was skipped/failed. Null when none. */
      prError?: string | null;
      /** PR-stage outcome — see CommitDraftChangesResult.pr_status. */
      prStatus?: PRStatus;
    };

    /** Draft operation error */
    'wiki/draft/error': { error: string };
  }
}
