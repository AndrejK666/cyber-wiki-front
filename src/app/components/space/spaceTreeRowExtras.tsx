/**
 * Per-row renderers for the space-view FileTree.
 *
 * The same `FileTree` is reused in two modes:
 *   - narrow (file selected): compact badges only
 *   - wide  (no file selected): full columns — Comments / Activity / Size
 * Both are pure functions so the parent page can swap them via the
 * `renderRowExtras` prop without owning any of the layout details.
 */

import type { ReactNode } from 'react';
import { GitBranch, GitCommit, MessageSquare, Pencil } from 'lucide-react';
import type { SpaceEnrichmentsResponse, TreeNode } from '@/app/api';

type TFn = (key: string, params?: Record<string, string | number>) => string;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function renderNarrowRow(
  node: TreeNode,
  spaceEnrichments: SpaceEnrichmentsResponse,
  draftPaths: Set<string>,
  t: TFn,
): ReactNode {
  if (node.type === 'dir') return null;
  const entry = spaceEnrichments[node.path];
  const commentCount = entry?.comments?.length ?? 0;
  const prCount = entry?.pr_diff?.length ?? 0;
  const isDraft = draftPaths.has(node.path);
  if (!commentCount && !prCount && !isDraft) return null;
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      {commentCount > 0 && (
        <span
          className="inline-flex items-center gap-0.5 px-1 rounded text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          title={t('spaceView.tree.commentsCount', { count: commentCount })}
        >
          {commentCount}
        </span>
      )}
      {prCount > 0 && (
        <span
          className="inline-flex items-center px-1 rounded text-[10px] font-medium bg-purple-600 text-white"
          title={t('spaceView.tree.prsCount', { count: prCount })}
        >
          {t('spaceView.tree.prBadge')}
        </span>
      )}
      {isDraft && (
        <span
          className="inline-block w-2 h-2 rounded-full bg-yellow-500"
          title={t('spaceView.tree.draftMarker')}
          aria-label={t('spaceView.tree.draftMarker')}
        />
      )}
    </span>
  );
}

export function renderWideRow(
  node: TreeNode,
  spaceEnrichments: SpaceEnrichmentsResponse,
  draftPaths: Set<string>,
  t: TFn,
): ReactNode {
  const isFolder = node.type === 'dir';
  const entry = spaceEnrichments[node.path];
  const commentCount = entry?.comments?.length ?? 0;
  const prNumbers = (entry?.pr_diff ?? []).map((pr) => pr.pr_number);
  const editCount = entry?.edit?.length ?? 0;
  const localCount = entry?.local_changes?.length ?? 0;
  const commitCount = entry?.commit?.length ?? 0;
  const isDraft = !isFolder && draftPaths.has(node.path);
  const size = (node as TreeNode & { size?: number }).size;

  return (
    <>
      <span className="w-20 flex items-center justify-center">
        {commentCount > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
            title={t('spaceView.tree.commentsCount', { count: commentCount })}
          >
            <MessageSquare size={12} />
            {commentCount}
          </span>
        )}
      </span>
      <span className="w-40 flex items-center justify-center gap-1 flex-wrap">
        {prNumbers.length > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-600 text-white"
            title={t('spaceView.tree.prsTitle', { numbers: prNumbers.join(', ') })}
          >
            <GitBranch size={12} />
            {prNumbers.slice(0, 3).join(', ')}
            {prNumbers.length > 3 ? ` +${prNumbers.length - 3}` : ''}
          </span>
        )}
        {localCount > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-700 text-white"
            title={t('spaceView.tree.localChangesCount', { count: localCount })}
          >
            <Pencil size={12} />
            {localCount}
          </span>
        )}
        {editCount > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-700 text-white"
            title={t('spaceView.tree.editsCount', { count: editCount })}
          >
            <Pencil size={12} />
            {editCount}
          </span>
        )}
        {commitCount > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-700 text-white"
            title={t('spaceView.tree.commitsCount', { count: commitCount })}
          >
            <GitCommit size={12} />
            {commitCount}
          </span>
        )}
        {isDraft && (
          <span
            className="inline-block w-2 h-2 rounded-full bg-yellow-500"
            title={t('spaceView.tree.draftMarker')}
            aria-label={t('spaceView.tree.draftMarker')}
          />
        )}
      </span>
      <span className="w-16 text-right text-xs text-muted-foreground">
        {!isFolder && typeof size === 'number' && size >= 0 ? formatSize(size) : '—'}
      </span>
    </>
  );
}
