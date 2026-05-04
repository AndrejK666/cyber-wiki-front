/**
 * EnrichmentPanel — sidebar panel that aggregates all enrichments for a file.
 *
 * Tabs: Comments / Diffs / PRs / Local / Changes. Drives data via actions
 * (`loadEnrichments`, `loadComments`) and listens to `wiki/enrichments/loaded`
 * + `wiki/comments/loaded`. CommentsTab and ChangesTab are pulled in as
 * full-featured components; the remaining tabs are simple list-renders for
 * read-only payloads.
 */

import React, { useEffect, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import {
  AlertCircle,
  Bug,
  Check,
  Clock,
  Copy,
  Edit3,
  FileEdit,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  User,
} from 'lucide-react';
import { CommentsTab } from './CommentsTab';
import { ChangesTab } from './ChangesTab';
import { GitOpsLogPanel } from './GitOpsLogPanel';
import { loadComments, loadEnrichments } from '@/app/actions/enrichmentActions';
import { useDebugMode } from '@/app/lib/useDebugMode';
import { formatDateTime } from '@/app/lib/formatDate';
import {
  EnrichmentTab,
  type CommentData,
  type DiffEnrichment,
  type EnrichmentsResponse,
  type LocalChangeEnrichment,
  type PREnrichment,
  type PRReviewer,
} from '@/app/api/wikiTypes';

interface EnrichmentPanelProps {
  sourceUri: string;
  selectedLines?: { start: number; end: number } | null;
  activeTab?: EnrichmentTab;
  /** Optional — needed for ChangesTab actions (commit/create-PR). */
  spaceId?: string;
  /** Optional — lets the Debug tab filter the git-ops log down to this space. */
  spaceSlug?: string;
  /** Optional — used by ChangesTab to highlight current file row. */
  currentFilePath?: string;
}

export const EnrichmentPanel: React.FC<EnrichmentPanelProps> = ({
  sourceUri,
  selectedLines,
  activeTab: initialTab,
  spaceId,
  spaceSlug,
  currentFilePath,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<EnrichmentTab>(
    initialTab ?? EnrichmentTab.Comments,
  );
  const [enrichments, setEnrichments] = useState<EnrichmentsResponse | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [error, setError] = useState(false);
  // Hides every developer-only affordance (Debug tab, raw payload viewer)
  // behind a single toggle in Profile → Settings.
  const debugMode = useDebugMode();

  // If the user disables Debug while sitting on the Debug tab, fall back to
  // a tab the regular UI shows so they don't get stranded on a now-hidden one.
  useEffect(() => {
    if (!debugMode && activeTab === EnrichmentTab.Debug) {
      setActiveTab(EnrichmentTab.Comments);
    }
  }, [debugMode, activeTab]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Load + subscribe
  useEffect(() => {
    if (!sourceUri) return;
    setError(false);

    const enrichSub = eventBus.on('wiki/enrichments/loaded', (payload) => {
      if (payload.sourceUri === sourceUri) {
        setEnrichments(payload.enrichments ?? {});
      }
    });
    const enrichErrSub = eventBus.on('wiki/enrichments/error', () => {
      setError(true);
    });
    const commentsSub = eventBus.on('wiki/comments/loaded', (payload) => {
      if (payload.sourceUri === sourceUri) {
        setComments(payload.comments ?? []);
      }
    });

    loadEnrichments(sourceUri);
    loadComments(sourceUri);

    return () => {
      enrichSub.unsubscribe();
      enrichErrSub.unsubscribe();
      commentsSub.unsubscribe();
    };
  }, [sourceUri]);

  const safeEnrichments: EnrichmentsResponse = enrichments ?? {};
  const commentCount = comments.length;
  const diffCount = safeEnrichments.diff?.length ?? 0;
  const prCount = safeEnrichments.pr_diff?.length ?? 0;
  const localCount = safeEnrichments.local_changes?.length ?? 0;
  const changesCount =
    (safeEnrichments.edit?.length ?? 0) + (safeEnrichments.commit?.length ?? 0);

  const tabs: Array<{ id: EnrichmentTab; label: string; icon: React.ReactNode; count: number }> = [
    {
      id: EnrichmentTab.Comments,
      label: t('enrichmentPanel.tabComments'),
      icon: <MessageSquare size={16} />,
      count: commentCount,
    },
    {
      id: EnrichmentTab.Diffs,
      label: t('enrichmentPanel.tabDiffs'),
      icon: <FileEdit size={16} />,
      count: diffCount,
    },
    {
      id: EnrichmentTab.PRs,
      label: t('enrichmentPanel.tabPRs'),
      icon: <GitBranch size={16} />,
      count: prCount,
    },
    {
      id: EnrichmentTab.Local,
      label: t('enrichmentPanel.tabLocal'),
      icon: <AlertCircle size={16} />,
      count: localCount,
    },
    {
      id: EnrichmentTab.Changes,
      label: t('enrichmentPanel.tabChanges'),
      icon: <Edit3 size={16} />,
      count: changesCount,
    },
    {
      id: EnrichmentTab.Debug,
      label: t('enrichmentPanel.tabDebug'),
      icon: <Bug size={16} />,
      count: 0,
    },
  ];

  // When everything is missing AND we're not already on Debug, the early
  // failure card stays — but Debug is the place to diagnose this state, so
  // when it's enabled we surface a quick-jump button.
  if (
    error
    && !enrichments
    && comments.length === 0
    && activeTab !== EnrichmentTab.Debug
  ) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-center flex-1 p-8">
          <div className="text-destructive text-sm">{t('enrichmentPanel.errorTitle')}</div>
        </div>
        {debugMode && (
          <div className="flex border-t border-border">
            <button
              type="button"
              onClick={() => setActiveTab(EnrichmentTab.Debug)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Bug size={14} />
              {t('enrichmentPanel.openDebug')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex border-b border-border overflow-x-auto">
        {tabs
          .filter(
            (tab) =>
              // Debug tab is gated behind the Profile → Debug-mode toggle.
              (tab.id !== EnrichmentTab.Debug || debugMode)
              && (tab.id === EnrichmentTab.Comments
                || tab.id === EnrichmentTab.Debug
                || tab.count > 0),
          )
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'text-foreground border-primary bg-accent'
                  : 'text-muted-foreground border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-xs rounded ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === EnrichmentTab.Comments && (
          <CommentsTab
            comments={comments}
            sourceUri={sourceUri}
            selectedLines={selectedLines ?? null}
          />
        )}

        {activeTab === EnrichmentTab.Diffs && (
          <DiffsTabContent diffs={safeEnrichments.diff ?? []} />
        )}

        {activeTab === EnrichmentTab.PRs && (
          <PRsTabContent prs={safeEnrichments.pr_diff ?? []} />
        )}

        {activeTab === EnrichmentTab.Local && (
          <LocalChangesTabContent changes={safeEnrichments.local_changes ?? []} />
        )}

        {activeTab === EnrichmentTab.Changes && (
          <ChangesTab
            editEnrichments={safeEnrichments.edit ?? []}
            commitEnrichments={safeEnrichments.commit ?? []}
            spaceId={spaceId}
            currentFilePath={currentFilePath}
            onRefresh={() => loadEnrichments(sourceUri)}
          />
        )}

        {activeTab === EnrichmentTab.Debug && debugMode && (
          <DebugTabContent
            sourceUri={sourceUri}
            spaceId={spaceId}
            spaceSlug={spaceSlug}
            currentFilePath={currentFilePath}
            selectedLines={selectedLines ?? null}
            enrichments={enrichments}
            comments={comments}
            error={error}
            onReload={() => {
              loadEnrichments(sourceUri);
              loadComments(sourceUri);
            }}
          />
        )}
      </div>
    </div>
  );
};

EnrichmentPanel.displayName = 'EnrichmentPanel';

// =============================================================================
// DiffsTabContent
// =============================================================================

function DiffsTabContent({ diffs }: { diffs: DiffEnrichment[] }) {
  const { t } = useTranslation();
  if (diffs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileEdit size={32} className="mx-auto mb-2 opacity-50" />
        <div className="text-sm">{t('enrichmentPanel.diffsEmpty')}</div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {diffs.map((diff) => (
        <div key={diff.id} className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{diff.file_path}</span>
            <span className="text-xs text-muted-foreground">
              +{diff.stats.additions} / -{diff.stats.deletions}
            </span>
          </div>
          {diff.diff_hunks.map((hunk, i) => (
            <div key={i} className="font-mono text-xs">
              <div className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                @@ -{hunk.old_start},{hunk.old_count} +{hunk.new_start},{hunk.new_count} @@
              </div>
              {hunk.lines.map((line, j) => {
                const isAdd = line.startsWith('+');
                const isDel = line.startsWith('-');
                const cls = isAdd
                  ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                  : isDel
                    ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                    : 'text-foreground';
                return (
                  <div
                    key={j}
                    className={`px-2 py-0.5 whitespace-pre-wrap break-all ${cls}`}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// PRsTabContent
// =============================================================================

function ReviewerBadge({ reviewer }: { reviewer: PRReviewer }) {
  const isApproved = reviewer.status === 'APPROVED';
  return (
    <div className="flex items-center gap-1.5" title={`${reviewer.display_name} — ${reviewer.status}`}>
      {reviewer.avatar_url ? (
        <img
          src={reviewer.avatar_url}
          alt={reviewer.display_name}
          className="w-5 h-5 rounded-full"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
          <User size={12} className="text-muted-foreground" />
        </div>
      )}
      <span className="text-xs text-foreground">{reviewer.display_name || reviewer.username}</span>
      {isApproved ? (
        <Check size={12} className="text-green-600" />
      ) : (
        <Clock size={12} className="text-yellow-600" />
      )}
    </div>
  );
}

function PRsTabContent({ prs }: { prs: PREnrichment[] }) {
  const { t } = useTranslation();
  if (prs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GitPullRequest size={32} className="mx-auto mb-2 opacity-50" />
        <div className="text-sm">{t('enrichmentPanel.prsEmpty')}</div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      {prs.map((pr) => (
        <div key={pr.pr_number} className="border border-border rounded-lg p-4 bg-muted">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{pr.pr_title}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
              #{pr.pr_number}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('enrichmentPanel.prsByAuthor', { author: pr.pr_author, state: pr.pr_state })}
          </div>
          {pr.reviewers && pr.reviewers.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-1.5">{t('enrichmentPanel.reviewersHeader')}</div>
              <div className="flex flex-wrap gap-2">
                {pr.reviewers.map((r) => (
                  <ReviewerBadge key={r.username} reviewer={r} />
                ))}
              </div>
            </div>
          )}
          {pr.pr_url && (
            <a
              href={pr.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-2 inline-block"
            >
              {t('enrichmentPanel.viewPR')}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// LocalChangesTabContent
// =============================================================================

// =============================================================================
// DebugTabContent — raw payload viewer for diagnosing enrichment issues
// =============================================================================

interface DebugTabContentProps {
  sourceUri: string;
  spaceId?: string;
  spaceSlug?: string;
  currentFilePath?: string;
  selectedLines: { start: number; end: number } | null;
  enrichments: EnrichmentsResponse | null;
  comments: CommentData[];
  error: boolean;
  onReload: () => void;
}

function DebugTabContent({
  sourceUri,
  spaceId,
  spaceSlug,
  currentFilePath,
  selectedLines,
  enrichments,
  comments,
  error,
  onReload,
}: DebugTabContentProps) {
  const { t } = useTranslation();
  const safeEnrichments: EnrichmentsResponse = enrichments ?? {};
  const summary = {
    sourceUri,
    spaceId: spaceId ?? null,
    currentFilePath: currentFilePath ?? null,
    selectedLines,
    enrichmentsLoaded: enrichments !== null,
    enrichmentsError: error,
    counts: {
      comments: comments.length,
      diff: safeEnrichments.diff?.length ?? 0,
      pr_diff: safeEnrichments.pr_diff?.length ?? 0,
      local_changes: safeEnrichments.local_changes?.length ?? 0,
      edit: safeEnrichments.edit?.length ?? 0,
      commit: safeEnrichments.commit?.length ?? 0,
    },
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted text-xs">
        <Bug size={12} className="text-muted-foreground" />
        <span className="font-medium text-foreground">{t('enrichmentPanel.debugTitle')}</span>
        <span className="text-muted-foreground">{t('enrichmentPanel.debugSubtitle')}</span>
        <button
          type="button"
          onClick={onReload}
          className="ml-auto px-2 py-0.5 rounded border border-border bg-background text-foreground hover:bg-accent"
          title={t('enrichmentPanel.debugReloadTitle')}
        >
          {t('enrichmentPanel.debugReload')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <GitOpsLogPanel spaceSlug={spaceSlug} />
        <DebugSection title={t('enrichmentPanel.debugSummary')} value={summary} />
        <DebugSection title={t('enrichmentPanel.debugCommentsLabel', { count: comments.length })} value={comments} />
        <DebugSection title={t('enrichmentPanel.debugEnrichmentsLabel')} value={enrichments} />
      </div>
    </div>
  );
}

// Local JSON-shaped value. Debug viewer only stringifies the payload, so a
// recursive any-shape JSON type keeps the public surface free of `unknown`.
type DebugValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | DebugValue[]
  | { [key: string]: DebugValue };

interface DebugSectionProps {
  title: string;
  value: DebugValue;
}

function DebugSection({ title, value }: DebugSectionProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  // Stringify defensively so circular references (rare, but possible from
  // hand-crafted payloads in tests) don't blow up the whole panel.
  let body: string;
  try {
    body = JSON.stringify(value, null, 2);
  } catch (e) {
    body = `// JSON.stringify failed: ${(e as Error).message}\n${String(value)}`;
  }
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API not available in the current context.
    }
  };
  return (
    <details open className="border border-border rounded-md bg-muted">
      <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs font-medium text-foreground select-none">
        <span className="flex-1 truncate">{title}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            void handleCopy();
          }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          title={t('enrichmentPanel.debugCopyTitle')}
        >
          {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
          {copied ? t('enrichmentPanel.debugCopied') : t('enrichmentPanel.debugCopy')}
        </button>
      </summary>
      <pre className="px-3 py-2 text-[11px] leading-snug font-mono text-foreground whitespace-pre-wrap break-words border-t border-border bg-background">
        {body}
      </pre>
    </details>
  );
}

function LocalChangesTabContent({ changes }: { changes: LocalChangeEnrichment[] }) {
  const { t } = useTranslation();
  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
        <div className="text-sm">{t('enrichmentPanel.localEmpty')}</div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      {changes.map((change) => (
        <div key={change.id} className="border border-border rounded-lg p-3 bg-muted">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} className="text-yellow-600" />
            <span className="text-sm font-medium text-foreground">
              {change.commit_message || t('enrichmentPanel.localDefaultLabel')}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{change.status}</span>
            <span>{formatDateTime(change.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
