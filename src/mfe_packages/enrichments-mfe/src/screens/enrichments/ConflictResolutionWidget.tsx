/**
 * ConflictResolutionWidget — modal for resolving conflicts between
 * uncommitted edits and committed changes.
 *
 * Displays added lines from both versions and lets the user choose which
 * version to keep. The other version is discarded.
 */

import { useTranslation } from '@cyberfabric/react';
import type { DiffHunk } from '../../api/types';
import { Modal, ModalSize } from '../../components/primitives/Modal';

interface ConflictResolutionWidgetProps {
  open: boolean;
  uncommittedHunk: DiffHunk | null;
  committedHunk: DiffHunk | null;
  filePath: string;
  onKeepUncommitted: () => void;
  onKeepCommitted: () => void;
  onDismiss: () => void;
}

function extractAddedLines(hunk: DiffHunk | null): string[] {
  if (!hunk?.lines) return [];
  return hunk.lines.filter((l) => l.startsWith('+')).map((l) => l.slice(1));
}

export function ConflictResolutionWidget({
  open,
  uncommittedHunk,
  committedHunk,
  filePath,
  onKeepUncommitted,
  onKeepCommitted,
  onDismiss,
}: ConflictResolutionWidgetProps) {
  const { t } = useTranslation();
  const uncommittedAdded = extractAddedLines(uncommittedHunk);
  const committedAdded = extractAddedLines(committedHunk);

  return (
    <Modal
      open={open}
      onClose={onDismiss}
      size={ModalSize.Lg}
      title={t('conflictWidget.title')}
    >
      <Modal.Body>
        <p className="text-sm text-muted-foreground mb-4">
          {t('conflictWidget.description', { path: filePath })}
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Uncommitted side */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-border">
              <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {t('conflictWidget.uncommittedLabel')}
              </h4>
            </div>
            <pre className="p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
              {uncommittedAdded.length > 0
                ? uncommittedAdded.join('\n')
                : t('conflictWidget.noChanges')}
            </pre>
          </div>

          {/* Committed side */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-green-50 dark:bg-green-950/30 border-b border-border">
              <h4 className="text-xs font-semibold text-green-700 dark:text-green-300">
                {t('conflictWidget.committedLabel')}
              </h4>
            </div>
            <pre className="p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
              {committedAdded.length > 0
                ? committedAdded.join('\n')
                : t('conflictWidget.noChanges')}
            </pre>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-1.5 text-sm rounded border border-border bg-background text-muted-foreground hover:bg-accent"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onKeepUncommitted}
          className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          {t('conflictWidget.keepUncommitted')}
        </button>
        <button
          type="button"
          onClick={onKeepCommitted}
          className="px-4 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
        >
          {t('conflictWidget.keepCommitted')}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
