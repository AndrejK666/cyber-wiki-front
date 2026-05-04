/**
 * RecentCommitsPanel — past commits from git-ops-log with PR status.
 *
 * Extracted from ChangesPage to keep that page focused on drafts/PRs and
 * this component focused on commit-history rendering. Listens to:
 *   - wiki/gitOpsLog/* — to populate the list
 *   - wiki/spaces/loaded — to resolve `space_slug → space_id`
 *   - wiki/draft/committed, wiki/branch/(unstaged|discarded) — to refresh
 *     after the user mutates state from the drafts panel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import {
  AlertCircle,
  Check,
  ExternalLink,
  FileText,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Loader2,
  MoreHorizontal,
  RotateCw,
  Undo2,
  X,
} from 'lucide-react';
import { type GitOpsLogEntry, GitOpsLogStatus } from '@/app/api';

enum CommitPrStatus {
  Created = 'created',
  Existing = 'existing',
  Failed = 'failed',
  None = 'none',
}
import { loadGitOpsLog } from '@/app/actions/gitOpsLogActions';
import { loadSpaces } from '@/app/actions/wikiActions';
import { createPullRequest, unstageBranch } from '@/app/actions/userBranchActions';
import { formatDateTime } from '@/app/lib/formatDate';

interface CommitEntry {
  ts: number;
  message: string;
  spaceSlug: string;
  spaceId: string | null;
  branch: string;
  sha: string | null;
  filesCommitted: number;
  status: GitOpsLogStatus;
  pr: { url: string; status: CommitPrStatus } | null;
  prError: string | null;
}

function buildCommitEntries(entries: GitOpsLogEntry[]): CommitEntry[] {
  const commits: CommitEntry[] = [];
  const prByBranch = new Map<string, GitOpsLogEntry>();

  for (const e of entries) {
    if (e.kind === 'pr.create.auto') {
      const key = `${e.space_slug}/${e.branch_name}`;
      if (!prByBranch.has(key)) prByBranch.set(key, e);
    }
  }

  for (const e of entries) {
    if (e.kind !== 'commit') continue;
    const branchKey = `${e.space_slug}/${e.branch_name}`;
    const prEntry = prByBranch.get(branchKey);
    let pr: CommitEntry['pr'] = null;
    let prError: string | null = null;

    if (prEntry) {
      if (prEntry.status === GitOpsLogStatus.Ok) {
        const prUrl = (prEntry.payload?.pr_url as string) || '';
        pr = {
          url: prUrl,
          status: prEntry.message?.toLowerCase().includes('existing')
            ? CommitPrStatus.Existing
            : CommitPrStatus.Created,
        };
      } else if (prEntry.status === GitOpsLogStatus.Error) {
        pr = { url: '', status: CommitPrStatus.Failed };
        prError = prEntry.message || 'PR creation failed';
      }
    }

    commits.push({
      ts: e.ts,
      message: e.message,
      spaceSlug: e.space_slug,
      spaceId: (e.payload?.space_id as string) || null,
      branch: e.branch_name,
      sha: (e.payload?.commit_sha as string) || null,
      filesCommitted: (e.payload?.files_committed as number) || 0,
      status: e.status,
      pr,
      prError,
    });
  }

  return commits;
}

export function RecentCommitsPanel() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<{ slug: string; id: string }[]>([]);

  // Subscribe to gitOpsLog and spaces — emit one load so the subscription
  // fires even when those domains were already populated before mount.
  useEffect(() => {
    const subLoaded = eventBus.on('wiki/gitOpsLog/loaded', ({ entries: rawEntries }) => {
      setEntries(buildCommitEntries(rawEntries));
      setLoading(false);
    });
    const subError = eventBus.on('wiki/gitOpsLog/error', () => {
      setLoading(false);
    });
    const subSpaces = eventBus.on('wiki/spaces/loaded', ({ all }) => {
      setSpaces((all || []).map((s: { slug: string; id: string }) => ({ slug: s.slug, id: s.id })));
    });

    setLoading(true);
    loadGitOpsLog(100);
    loadSpaces();

    return () => {
      subLoaded.unsubscribe();
      subError.unsubscribe();
      subSpaces.unsubscribe();
    };
  }, []);

  // Refresh after a commit is made or a branch is unstaged/discarded
  useEffect(() => {
    const refresh = () => {
      setLoading(true);
      loadGitOpsLog(100);
    };
    const subs = [
      eventBus.on('wiki/draft/committed', refresh),
      eventBus.on('wiki/branch/unstaged', refresh),
      eventBus.on('wiki/branch/discarded', refresh),
    ];
    return () => { subs.forEach((s) => s.unsubscribe()); };
  }, []);

  const resolveSpaceId = useCallback(
    (entry: CommitEntry): string | null => {
      if (entry.spaceId) return entry.spaceId;
      const match = spaces.find((s) => s.slug === entry.spaceSlug);
      return match?.id ?? null;
    },
    [spaces],
  );

  if (loading) {
    return (
      <div className="border border-border rounded-lg">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border rounded-t-lg">
          <GitCommit size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{t('recentCommits.title')}</h3>
        </div>
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          <Loader2 size={20} className="mx-auto mb-2 animate-spin opacity-50" />
          {t('recentCommits.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border rounded-t-lg">
        <GitCommit size={14} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{t('recentCommits.title')}</h3>
        <span className="text-xs text-muted-foreground">{entries.length}</span>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadGitOpsLog(100);
          }}
          className="ml-auto p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          title={t('recentCommits.reloadTitle')}
        >
          <RotateCw size={12} />
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <GitCommit size={32} className="mx-auto mb-2 opacity-30" />
          <p>{t('recentCommits.empty')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((c, i) => (
            <CommitRow
              key={`${c.ts}-${i}`}
              entry={c}
              resolveSpaceId={resolveSpaceId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommitRow({
  entry: c,
  resolveSpaceId,
}: {
  entry: CommitEntry;
  resolveSpaceId: (entry: CommitEntry) => string | null;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Listen for success/error events to clear busy state
  useEffect(() => {
    const subs = [
      eventBus.on('wiki/branch/unstaged', () => { setBusy(false); setActionError(null); }),
      eventBus.on('wiki/branch/discarded', () => { setBusy(false); setActionError(null); }),
      eventBus.on('wiki/pr/created', () => { setBusy(false); setActionError(null); }),
      eventBus.on('wiki/branch/error', ({ error }) => { setBusy(false); setActionError(error); }),
    ];
    return () => { subs.forEach((s) => s.unsubscribe()); };
  }, []);

  const hasPr = c.pr?.status === CommitPrStatus.Created || c.pr?.status === CommitPrStatus.Existing;
  const canRevert = c.status === GitOpsLogStatus.Ok && !hasPr;
  const canRetryPr = c.pr?.status === CommitPrStatus.Failed;
  const spaceId = resolveSpaceId(c);

  const handleRevert = () => {
    setMenuOpen(false);
    if (!spaceId) {
      setActionError(t('recentCommits.errorMissingSpace', { slug: c.spaceSlug }));
      return;
    }
    setBusy(true);
    setActionError(null);
    unstageBranch(spaceId);
  };

  const handleRetryPr = () => {
    setMenuOpen(false);
    if (!spaceId) {
      setActionError(t('recentCommits.errorMissingSpace', { slug: c.spaceSlug }));
      return;
    }
    setBusy(true);
    setActionError(null);
    createPullRequest({ spaceId });
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {c.status === GitOpsLogStatus.Ok ? (
            <Check size={14} className="text-green-600" />
          ) : (
            <X size={14} className="text-destructive" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-foreground truncate">
              {c.message || t('common.create')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{formatDateTime(c.ts)}</span>
            <span className="flex items-center gap-1">
              <FileText size={10} />
              {c.spaceSlug}
            </span>
            <span className="flex items-center gap-1">
              <GitBranch size={10} />
              {c.branch}
            </span>
            {c.sha && (
              <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted">
                {c.sha.slice(0, 7)}
              </code>
            )}
            {c.filesCommitted > 0 && (
              <span>{t(c.filesCommitted === 1 ? 'recentCommits.fileCount' : 'recentCommits.fileCount_plural', { count: c.filesCommitted })}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <CommitPrBadge pr={c.pr} prError={c.prError} />
          {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          {(canRevert || canRetryPr) && !busy && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                title={t('recentCommits.moreActions')}
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-full mb-1 z-20 min-w-[160px] rounded-md border border-border bg-popover shadow-md py-1">
                  {canRevert && (
                    <button
                      type="button"
                      onClick={handleRevert}
                      disabled={!spaceId || busy}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-40"
                      title={!spaceId ? t('recentCommits.revertMissing', { slug: c.spaceSlug }) : t('recentCommits.revertTitle')}
                    >
                      <Undo2 size={12} />
                      {t('recentCommits.revert')}
                    </button>
                  )}
                  {canRetryPr && (
                    <button
                      type="button"
                      onClick={handleRetryPr}
                      disabled={!spaceId || busy}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-40"
                      title={!spaceId ? t('recentCommits.revertMissing', { slug: c.spaceSlug }) : t('recentCommits.retryPrTitle')}
                    >
                      <GitPullRequest size={12} />
                      {t('recentCommits.retryPr')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {actionError && (
        <div className="mt-1.5 ml-[26px] flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          <span className="break-words">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="flex-shrink-0 p-0.5 rounded hover:bg-destructive/20">
            <X size={10} />
          </button>
        </div>
      )}
    </li>
  );
}

function CommitPrBadge({ pr, prError }: { pr: CommitEntry['pr']; prError: string | null }) {
  const { t } = useTranslation();
  if (!pr) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground" title={t('recentCommits.noPr')}>
        <GitPullRequest size={10} />
        {t('recentCommits.noPr')}
      </span>
    );
  }

  if (pr.status === CommitPrStatus.Failed) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
        title={prError || t('recentCommits.prFailed')}
      >
        <AlertCircle size={10} />
        {t('recentCommits.prFailed')}
      </span>
    );
  }

  const label = pr.status === CommitPrStatus.Created ? t('recentCommits.prCreated') : t('recentCommits.prExists');
  const classes = pr.status === CommitPrStatus.Created
    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
    : 'bg-blue-500/10 text-blue-700 dark:text-blue-400';

  return pr.url ? (
    <a
      href={pr.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${classes} hover:underline`}
      title={pr.url}
    >
      <GitPullRequest size={10} />
      {label}
      <ExternalLink size={8} />
    </a>
  ) : (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${classes}`}>
      <GitPullRequest size={10} />
      {label}
    </span>
  );
}
