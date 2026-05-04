/**
 * ConflictDetailsDialog — modal for reviewing enrichment conflicts.
 * Ported from doclab ConflictDetailsDialog to host app.
 */

import React, { useState } from 'react';
import { useTranslation } from '@cyberfabric/react';
import { EnrichmentType, type Enrichment, type DiffHunkRaw } from '@/app/api/wikiTypes';
import { Modal, ModalSize } from '@/app/components/primitives/Modal';

interface ConflictDetailsDialogProps {
  conflicts: Enrichment[];
  initialIndex?: number;
  onClose: () => void;
}

function useEnrichmentLabel() {
  const { t } = useTranslation();
  return (e: Enrichment | null | undefined): string => {
    if (!e) return '?';
    const d = e.data;
    if (e.type === EnrichmentType.PRDiff) return t('conflictDetails.prLabel', { number: d?.pr_number ?? '' });
    if (e.type === EnrichmentType.Commit) return t('conflictDetails.commitLabel', { sha: String(d?.commit_sha).slice(0, 7) });
    if (e.type === EnrichmentType.Edit) return t('conflictDetails.yourPendingEdit');
    return String(e.type);
  };
}

function HunkDiff({ hunk }: { hunk: DiffHunkRaw | undefined }) {
  if (!hunk?.lines?.length) return null;
  return (
    <pre className="text-xs rounded overflow-x-auto p-2 m-0 leading-5 bg-muted font-mono">
      {hunk.lines.map((line, i) => {
        const prefix = line[0];
        const content = line.slice(1);
        const colorClass =
          prefix === '+' ? 'text-green-700' : prefix === '-' ? 'text-red-700' : 'text-muted-foreground';
        return (
          <div key={i} className={colorClass}>
            {prefix}
            {content}
          </div>
        );
      })}
    </pre>
  );
}

export const ConflictDetailsDialog: React.FC<ConflictDetailsDialogProps> = ({
  conflicts,
  initialIndex = 0,
  onClose,
}) => {
  const { t } = useTranslation();
  const enrichmentLabel = useEnrichmentLabel();
  const [index, setIndex] = useState(initialIndex);
  if (conflicts.length === 0) return null;
  const conflict = conflicts[Math.min(index, conflicts.length - 1)];
  const { firstEnrichment, secondEnrichment, hunk } = (conflict?.data ?? {}) as {
    firstEnrichment?: Enrichment;
    secondEnrichment?: Enrichment;
    hunk?: DiffHunkRaw;
  };

  const winnerLabel = enrichmentLabel(firstEnrichment);
  const loserLabel = enrichmentLabel(secondEnrichment);
  const lineRange =
    conflict.lineStart === conflict.lineEnd
      ? t('conflictDetails.lineRangeSingle', { line: conflict.lineStart })
      : t('conflictDetails.lineRangeMulti', { start: conflict.lineStart, end: conflict.lineEnd });

  return (
    <Modal open={true} onClose={onClose} size={ModalSize.Md} contentClassName="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-destructive/5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-destructive">{t('conflictDetails.headerLabel')}</span>
            {conflicts.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  disabled={index === 0}
                  onClick={() => setIndex(i => i - 1)}
                >
                  ‹
                </button>
                <span className="text-xs text-muted-foreground">
                  {t('conflictDetails.indexOf', { index: index + 1, total: conflicts.length })}
                </span>
                <button
                  className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  disabled={index === conflicts.length - 1}
                  onClick={() => setIndex(i => i + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
          <button
            className="text-muted-foreground hover:text-foreground text-base leading-none px-1"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('conflictDetails.summary', { winner: winnerLabel, loser: loserLabel, range: lineRange })}
          </p>

          <div className="rounded-md border border-green-200 dark:border-green-800 overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border-b border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
              <span>{t('conflictDetails.appliedLabel')}</span>
              <span className="font-normal">{winnerLabel}</span>
            </div>
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t('conflictDetails.appliedDescription')}
            </div>
          </div>

          <div className="rounded-md border border-red-200 dark:border-red-800 overflow-hidden">
            <div className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400">
              <span>{t('conflictDetails.blockedLabel')}</span>
              <span className="font-normal">{loserLabel}</span>
            </div>
            <div className="p-2">
              {hunk ? (
                <HunkDiff hunk={hunk} />
              ) : (
                <p className="text-xs text-muted-foreground px-1">{t('conflictDetails.noHunk')}</p>
              )}
            </div>
          </div>
        </div>
    </Modal>
  );
};
