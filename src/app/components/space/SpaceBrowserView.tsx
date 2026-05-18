/**
 * SpaceBrowserView — read-only file-list overview shown when no document is
 * selected. Mirrors doclab's FileBrowserView: per-file row with name,
 * enrichment badges (comments, PRs, drafts, local changes, edits), and size.
 *
 * Data flows in from `SpaceViewPage`:
 *   - `tree` (full loaded tree) + `browserPath` → the rows we render
 *   - `enrichments` (space-level map keyed by file_path) → the badge counts
 */

import { useMemo } from 'react';
import { useTranslation } from '@cyberfabric/react';
import {
  ChevronUp,
  File,
  FileText,
  Folder,
  GitBranch,
  GitCommit,
  MessageSquare,
  Pencil,
} from 'lucide-react';
import {
  TreeNodeType,
  ViewMode,
  type PREnrichment,
  type SpaceEnrichmentsResponse,
  type TreeNode,
} from '@/app/api';

interface SpaceBrowserViewProps {
  tree: TreeNode[];
  enrichments: SpaceEnrichmentsResponse;
  /** Empty string = repo root; otherwise a folder path. */
  browserPath: string;
  viewMode: ViewMode;
  onSelectFile: (node: TreeNode) => void;
  onNavigatePath: (nextPath: string) => void;
}

type EnrichmentSummary = {
  comments: number;
  prNumbers: number[];
  edits: number;
  localChanges: number;
  commits: number;
};

function summarise(entry: SpaceEnrichmentsResponse[string] | undefined): EnrichmentSummary {
  if (!entry) {
    return { comments: 0, prNumbers: [], edits: 0, localChanges: 0, commits: 0 };
  }
  return {
    comments: entry.comments?.length ?? 0,
    prNumbers: (entry.pr_diff ?? []).map((pr: PREnrichment) => pr.pr_number),
    edits: entry.edit?.length ?? 0,
    localChanges: entry.local_changes?.length ?? 0,
    commits: entry.commit?.length ?? 0,
  };
}

function findNodesAtPath(tree: TreeNode[], path: string): TreeNode[] {
  if (!path) return tree;
  const segments = path.split('/').filter(Boolean);
  let current: TreeNode[] = tree;
  for (const segment of segments) {
    const next = current.find((n) => n.type === TreeNodeType.Dir && (n.name === segment || n.path.split('/').pop() === segment));
    if (!next || !next.children) return [];
    current = next.children;
  }
  return current;
}

export function SpaceBrowserView({
  tree,
  enrichments,
  browserPath,
  viewMode,
  onSelectFile,
  onNavigatePath,
}: SpaceBrowserViewProps) {
  const { t } = useTranslation();

  const items = useMemo(() => findNodesAtPath(tree, browserPath), [tree, browserPath]);

  // Sort: directories first, then by display name / raw name.
  const sorted = useMemo(() => {
    const useRaw = viewMode === ViewMode.Dev;
    const labelFor = (n: TreeNode) =>
      (useRaw ? n.name : n.display_name || n.name) || n.path;
    return [...items].sort((a, b) => {
      const aDir = a.type === TreeNodeType.Dir;
      const bDir = b.type === TreeNodeType.Dir;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return labelFor(a).localeCompare(labelFor(b));
    });
  }, [items, viewMode]);

  const isRoot = !browserPath;
  const parentPath = isRoot ? '' : browserPath.split('/').slice(0, -1).join('/');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header: breadcrumb */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/30">
        {!isRoot && (
          <button
            type="button"
            onClick={() => onNavigatePath(parentPath)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            title={t('spaceBrowser.up')}
          >
            <ChevronUp size={16} />
            {t('spaceBrowser.up')}
          </button>
        )}
        <div className="text-sm text-foreground truncate">
          {browserPath || t('spaceBrowser.repoRoot')}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-4 px-6 py-2 border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
        <div className="col-span-6">{t('spaceBrowser.colName')}</div>
        <div className="col-span-2 text-center">{t('spaceBrowser.colComments')}</div>
        <div className="col-span-3 text-center">{t('spaceBrowser.colActivity')}</div>
        <div className="col-span-1 text-right">{t('spaceBrowser.colSize')}</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('spaceBrowser.empty')}
          </div>
        ) : (
          sorted.map((node) => {
            const isFolder = node.type === TreeNodeType.Dir;
            const summary = summarise(enrichments[node.path]);
            const hasAny =
              summary.comments > 0 ||
              summary.prNumbers.length > 0 ||
              summary.edits > 0 ||
              summary.localChanges > 0 ||
              summary.commits > 0;
            const label = (viewMode === ViewMode.Dev ? node.name : node.display_name || node.name) || node.path;
            const size = (node as TreeNode & { size?: number }).size;

            return (
              <button
                key={node.path}
                type="button"
                onClick={() => {
                  if (isFolder) {
                    onNavigatePath(node.path);
                  } else {
                    onSelectFile(node);
                  }
                }}
                className={`w-full grid grid-cols-12 gap-4 px-6 py-2.5 border-b border-border text-left items-center hover:bg-accent/40 transition-colors ${
                  hasAny ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''
                }`}
              >
                <div className="col-span-6 flex items-center gap-3 min-w-0">
                  {isFolder ? (
                    <Folder size={18} className="text-blue-600 flex-shrink-0" />
                  ) : viewMode === ViewMode.Documents ? (
                    <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                  ) : (
                    <File size={18} className="text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`truncate text-foreground ${isFolder ? 'font-medium' : ''}`}>{label}</span>
                </div>

                <div className="col-span-2 flex items-center justify-center">
                  {summary.comments > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                      <MessageSquare size={12} />
                      {summary.comments}
                    </span>
                  )}
                </div>

                <div className="col-span-3 flex items-center justify-center gap-1 flex-wrap">
                  {summary.prNumbers.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-600 text-white"
                      title={t('spaceBrowser.prsTitle', { numbers: summary.prNumbers.join(', ') })}
                    >
                      <GitBranch size={12} />
                      {summary.prNumbers.slice(0, 3).join(', ')}
                      {summary.prNumbers.length > 3 && ` +${summary.prNumbers.length - 3}`}
                    </span>
                  )}
                  {summary.localChanges > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-700 text-white"
                      title={t('spaceBrowser.localChangesTitle', { count: summary.localChanges })}
                    >
                      <Pencil size={12} />
                      {summary.localChanges}
                    </span>
                  )}
                  {summary.edits > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-700 text-white"
                      title={t('spaceBrowser.editsTitle', { count: summary.edits })}
                    >
                      <Pencil size={12} />
                      {summary.edits}
                    </span>
                  )}
                  {summary.commits > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-700 text-white"
                      title={t('spaceBrowser.commitsTitle', { count: summary.commits })}
                    >
                      <GitCommit size={12} />
                      {summary.commits}
                    </span>
                  )}
                </div>

                <div className="col-span-1 text-right text-xs text-muted-foreground">
                  {!isFolder && typeof size === 'number' && size >= 0 ? formatSize(size) : '—'}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
