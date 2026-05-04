/**
 * GitOpsLogPanel — debug viewer for the per-user git operations ring-buffer.
 *
 * Pulls /api/wiki/v1/git-ops-log/, renders newest-first. Drives the "what
 * just happened with my commit / PR?" question that the user otherwise has
 * to answer by tailing server logs. Rendered inside the Debug tab of
 * EnrichmentPanel — gating is handled by the caller.
 */

import { useEffect, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { Check, Loader2, RotateCw, Trash2, X } from 'lucide-react';
import { type GitOpsLogEntry, GitOpsLogStatus } from '@/app/api';
import { clearGitOpsLog, loadGitOpsLog } from '@/app/actions/gitOpsLogActions';
import { formatDateTime, formatTime } from '@/app/lib/formatDate';

interface GitOpsLogPanelProps {
  /** Optional space slug — when set, entries are filtered down to that
   *  space. Helps keep the panel useful when the user has many spaces. */
  spaceSlug?: string;
}

export function GitOpsLogPanel({ spaceSlug }: GitOpsLogPanelProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<GitOpsLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const subLoaded = eventBus.on('wiki/gitOpsLog/loaded', ({ entries: next }) => {
      setEntries(next);
      setLoading(false);
      setClearing(false);
    });
    const subError = eventBus.on('wiki/gitOpsLog/error', ({ error: msg }) => {
      setError(msg);
      setLoading(false);
      setClearing(false);
    });

    setLoading(true);
    setError(null);
    loadGitOpsLog(100);

    return () => {
      subLoaded.unsubscribe();
      subError.unsubscribe();
    };
  }, []);

  const handleReload = () => {
    setLoading(true);
    setError(null);
    loadGitOpsLog(100);
  };

  const handleClear = () => {
    if (clearing) return;
    setClearing(true);
    setError(null);
    clearGitOpsLog();
  };

  const filtered = spaceSlug
    ? entries.filter((e) => e.space_slug === spaceSlug)
    : entries;

  return (
    <details open className="border border-border rounded-md bg-muted">
      <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs font-medium text-foreground select-none">
        <span className="flex-1 truncate">{t('gitOpsLog.title')} ({filtered.length})</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handleReload();
          }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          title={t('gitOpsLog.reload')}
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handleClear();
          }}
          disabled={clearing || filtered.length === 0}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive disabled:opacity-40"
          title={t('gitOpsLog.clearTitle')}
        >
          <Trash2 size={11} />
        </button>
      </summary>

      <div className="border-t border-border bg-background">
        {error && (
          <div className="px-3 py-2 text-xs text-destructive break-words">
            {error}
          </div>
        )}
        {!error && filtered.length === 0 && !loading && (
          <div className="px-3 py-3 text-xs text-muted-foreground italic">
            {t('gitOpsLog.empty')}
          </div>
        )}
        {filtered.length > 0 && (
          <ul className="divide-y divide-border">
            {filtered.map((entry, i) => (
              <GitOpsLogRow key={`${entry.ts}-${entry.kind}-${i}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function GitOpsLogRow({ entry }: { entry: GitOpsLogEntry }) {
  const { t } = useTranslation();
  const tsLabel = formatTime(entry.ts);
  const tsTitle = formatDateTime(entry.ts, '');
  const isError = entry.status === GitOpsLogStatus.Error;
  const isOk = entry.status === GitOpsLogStatus.Ok;
  const payloadJson = JSON.stringify(entry.payload ?? {}, null, 2);
  const hasPayload = payloadJson !== '{}';

  return (
    <li className="px-3 py-2 text-[11px] leading-snug">
      <div className="flex items-center gap-2 mb-0.5">
        <StatusIcon status={entry.status} />
        <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono">
          {entry.kind || '?'}
        </code>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            isError
              ? 'bg-destructive/10 text-destructive'
              : isOk
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
          }`}
        >
          {entry.status}
        </span>
        {entry.space_slug && (
          <span className="text-muted-foreground truncate" title={entry.space_slug}>
            {entry.space_slug}
          </span>
        )}
        {entry.branch_name && (
          <code className="text-muted-foreground/80 truncate" title={entry.branch_name}>
            {entry.branch_name}
          </code>
        )}
        <span className="ml-auto text-muted-foreground" title={tsTitle}>
          {tsLabel}
        </span>
      </div>
      {entry.message && (
        <div className="text-foreground whitespace-pre-wrap break-words">
          {entry.message}
        </div>
      )}
      {hasPayload && (
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            {t('gitOpsLog.payload')}
          </summary>
          <pre className="mt-1 p-2 rounded bg-muted text-[10px] font-mono whitespace-pre-wrap break-words">
            {payloadJson}
          </pre>
        </details>
      )}
    </li>
  );
}

function StatusIcon({ status }: { status: GitOpsLogStatus }) {
  if (status === GitOpsLogStatus.Ok) return <Check size={11} className="text-green-600 flex-shrink-0" />;
  if (status === GitOpsLogStatus.Error) return <X size={11} className="text-destructive flex-shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />;
}
