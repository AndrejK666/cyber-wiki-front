/**
 * FileViewerHeader — toolbar for the file content view.
 *
 * Houses breadcrumb, content filter, edit/save/cancel, ViewModeSwitcher,
 * and Comments panel toggle. Lifted from doclab FileViewerHeader and
 * rebuilt on cyber-wiki's FileViewMode.
 */

import { useTranslation } from '@cyberfabric/react';
import { ArrowLeft, Filter, MessageSquare, Pencil, Save, X } from 'lucide-react';
import { ViewModeSwitcher } from '@/app/components/file/ViewModeSwitcher';
import { FileViewMode } from '@/app/api';

export enum ContentFilterType {
  All = 'all',
  Original = 'original',
  MyChanges = 'my_changes',
  MyCommits = 'my_commits',
}

export type ContentFilter =
  | ContentFilterType
  | { type: 'pr'; prNumber: number }
  | { type: 'commit'; commitSha: string };

interface FileViewerHeaderProps {
  filePath: string;
  breadcrumbPath?: string;
  spaceName: string;
  viewMode: FileViewMode;
  isEditMode: boolean;
  commentsCount?: number;
  showCommentsPanel: boolean;
  prNumbers?: number[];
  commitShas?: string[];
  hasUncommittedChanges?: boolean;
  hasCommittedChanges?: boolean;
  contentFilter?: ContentFilter;
  isDirty?: boolean;
  onBack: () => void;
  onViewModeChange: (mode: FileViewMode) => void;
  onToggleEdit: () => void;
  onToggleComments: () => void;
  onContentFilterChange?: (filter: ContentFilter) => void;
  onSave?: () => void;
  onCancel?: () => void;
}

function getFilterValue(filter: ContentFilter): string {
  if (typeof filter === 'string') return filter;
  if (filter.type === 'pr') return `pr-${filter.prNumber}`;
  return `commit-${filter.commitSha}`;
}

function parseFilterValue(value: string): ContentFilter {
  if (
    value === ContentFilterType.All ||
    value === ContentFilterType.Original ||
    value === ContentFilterType.MyChanges ||
    value === ContentFilterType.MyCommits
  ) {
    return value;
  }
  if (value.startsWith('pr-')) {
    return { type: 'pr', prNumber: Number(value.slice(3)) };
  }
  if (value.startsWith('commit-')) {
    return { type: 'commit', commitSha: value.slice(7) };
  }
  return ContentFilterType.All;
}

export function FileViewerHeader({
  filePath,
  breadcrumbPath,
  spaceName,
  viewMode,
  isEditMode,
  commentsCount,
  showCommentsPanel,
  prNumbers,
  commitShas,
  hasUncommittedChanges,
  hasCommittedChanges,
  contentFilter = ContentFilterType.All,
  isDirty,
  onBack,
  onViewModeChange,
  onToggleEdit,
  onToggleComments,
  onContentFilterChange,
  onSave,
  onCancel,
}: FileViewerHeaderProps) {
  const { t } = useTranslation();
  const showContentFilter =
    !isEditMode &&
    !!onContentFilterChange &&
    ((prNumbers && prNumbers.length > 0) || hasUncommittedChanges || hasCommittedChanges);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted">
      {/* Left: back, breadcrumb, content filter */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-background text-primary hover:bg-accent"
        >
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>
        <div className="text-xs text-muted-foreground">
          {spaceName} / {breadcrumbPath || filePath}
        </div>

        {showContentFilter && (
          <>
            <div className="w-px h-4 self-center bg-border" />
            <div className="flex items-center gap-1">
              <Filter size={12} className="text-muted-foreground" />
              <select
                value={getFilterValue(contentFilter)}
                onChange={(e) => onContentFilterChange?.(parseFilterValue(e.target.value))}
                className="px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground"
              >
                <option value={ContentFilterType.All}>{t('fileViewerHeader.filterAll')}</option>
                <option value={ContentFilterType.Original}>{t('fileViewerHeader.filterOriginal')}</option>
                {hasUncommittedChanges && (
                  <option value={ContentFilterType.MyChanges}>{t('fileViewerHeader.filterMyDraft')}</option>
                )}
                {hasCommittedChanges && (
                  <option value={ContentFilterType.MyCommits}>{t('fileViewerHeader.filterMyCommits')}</option>
                )}
                {prNumbers?.map((prNum) => (
                  <option key={prNum} value={`pr-${prNum}`}>
                    {t('prBanner.prNumber', { number: prNum })}
                  </option>
                ))}
                {commitShas?.map((sha) => (
                  <option key={sha} value={`commit-${sha}`}>
                    {sha.slice(0, 7)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Right: edit / view-mode / comments */}
      <div className="flex items-center gap-1.5">
        {isEditMode ? (
          <>
            <button
              type="button"
              onClick={onSave}
              disabled={!isDirty}
              title={t('fileViewerHeader.saveTitle')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-border disabled:opacity-40 disabled:cursor-not-allowed ${
                isDirty
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-background text-muted-foreground'
              }`}
            >
              <Save size={12} />
              {t('common.save')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              title={t('fileViewerHeader.discardTitle')}
              className="flex items-center px-1.5 py-0.5 text-xs rounded border border-border bg-background text-muted-foreground hover:bg-accent"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleEdit}
            title={t('fileViewerHeader.editTitle')}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-border bg-background text-foreground hover:bg-accent"
          >
            <Pencil size={12} />
            {t('common.edit')}
          </button>
        )}

        <ViewModeSwitcher currentMode={viewMode} onModeChange={onViewModeChange} />

        <button
          type="button"
          onClick={onToggleComments}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
            showCommentsPanel
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-background text-foreground border border-border hover:bg-accent'
          }`}
        >
          <MessageSquare size={14} />
          {t('fileViewerHeader.comments')} {commentsCount ? `(${commentsCount})` : ''}
        </button>
      </div>
    </div>
  );
}
