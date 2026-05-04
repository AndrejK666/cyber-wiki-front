/**
 * ChangesPage — global list of every pending draft change the user has made
 * across all spaces. Click a row → navigate into the space + open the file.
 */

import { useEffect, useMemo, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { lowerCase, trim } from 'lodash';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  FileText,
  Filter,
  GitCommit,
  Plus,
  Minus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';
import {
  commitDrafts,
  discardDraft,
  loadDrafts,
} from '@/app/actions/draftChangeActions';
import { createPullRequest } from '@/app/actions/userBranchActions';
import { PageTitle } from '@/app/layout';
import {
  EditChangeType,
  GroupSelectionState,
  PRStatus,
  Urls,
  type DraftChangeListItem,
} from '@/app/api';
import { formatDateTime } from '@/app/lib/formatDate';
import { CommitPrBanner } from '@/app/components/changes/CommitPrBanner';
import { RecentCommitsPanel } from '@/app/components/changes/RecentCommitsPanel';

interface ChangesPageProps {
  navigate: (view: string) => void;
}

interface SpaceGroup {
  spaceSlug: string;
  drafts: DraftChangeListItem[];
}

function changeIcon(type: EditChangeType) {
  if (type === EditChangeType.Create) return <Plus size={14} className="text-green-600" />;
  if (type === EditChangeType.Delete) return <Minus size={14} className="text-red-600" />;
  return <Edit3 size={14} className="text-blue-600" />;
}

function changeBadgeClasses(type: EditChangeType) {
  if (type === EditChangeType.Create) {
    return 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300';
  }
  if (type === EditChangeType.Delete) {
    return 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300';
  }
  return 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300';
}

function groupBySpace(drafts: DraftChangeListItem[]): SpaceGroup[] {
  const map = new Map<string, SpaceGroup>();
  for (const d of drafts) {
    const key = d.space_slug || d.space_id;
    let group = map.get(key);
    if (!group) {
      group = { spaceSlug: key, drafts: [] };
      map.set(key, group);
    }
    group.drafts.push(d);
  }
  for (const g of map.values()) {
    g.drafts.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  return Array.from(map.values()).sort((a, b) => a.spaceSlug.localeCompare(b.spaceSlug));
}

function ChangesPage({ navigate }: ChangesPageProps) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<DraftChangeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EditChangeType | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState<DraftChangeListItem | null>(null);
  const [pendingDiscardSelected, setPendingDiscardSelected] = useState(false);
  const [lastCommitPr, setLastCommitPr] = useState<
    | {
        status: PRStatus;
        url: string | null;
        branch: string;
        error: string | null;
        spaceId: string;
        retrying: boolean;
      }
    | null
  >(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const loadedSub = eventBus.on('wiki/drafts/loaded', ({ drafts: list }) => {
      setDrafts(list);
      setLoading(false);
    });
    const errorSub = eventBus.on('wiki/draft/error', ({ error: msg }) => {
      setError(msg);
      setLoading(false);
      setBusy(false);
    });
    const refresh = () => {
      setBusy(false);
      loadDrafts();
    };
    const mutationSubs = [
      eventBus.on('wiki/draft/discarded', refresh),
      eventBus.on('wiki/draft/committed', ({ pr, prError, prStatus, branchName, spaceId }) => {
        setSelected(new Set());
        setCommitMessage('');
        setLastCommitPr({
          status: prStatus ?? (pr ? PRStatus.Existing : PRStatus.NotAttempted),
          url: pr?.prUrl ?? null,
          branch: branchName,
          error: prError ?? null,
          spaceId,
          retrying: false,
        });
        refresh();
      }),
      eventBus.on('wiki/pr/created', ({ result }) => {
        setLastCommitPr((prev) =>
          prev && prev.retrying
            ? { ...prev, status: PRStatus.Created, url: result.pr_url, error: null, retrying: false }
            : prev,
        );
      }),
      eventBus.on('wiki/branch/error', ({ error: msg }) => {
        setLastCommitPr((prev) =>
          prev && prev.retrying
            ? { ...prev, status: PRStatus.Failed, error: msg, retrying: false }
            : prev,
        );
      }),
    ];
    loadDrafts();
    return () => {
      loadedSub.unsubscribe();
      errorSub.unsubscribe();
      mutationSubs.forEach((s) => s.unsubscribe());
    };
  }, []);

  const groups = useMemo(() => {
    const filtered = drafts.filter((d) => {
      if (typeFilter !== null && d.change_type !== typeFilter) return false;
      const q = lowerCase(trim(search));
      if (q) {
        if (
          !lowerCase(d.file_path).includes(q) &&
          !lowerCase(d.space_slug).includes(q) &&
          !lowerCase(d.description || '').includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
    return groupBySpace(filtered);
  }, [drafts, search, typeFilter]);

  const total = drafts.length;
  const filteredTotal = groups.reduce((sum, g) => sum + g.drafts.length, 0);
  const visibleIds = useMemo(
    () => groups.flatMap((g) => g.drafts.map((d) => d.id)),
    [groups],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedSpaceCount = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts) {
      if (selected.has(d.id)) set.add(d.space_id);
    }
    return set.size;
  }, [drafts, selected]);

  const toggleGroup = (slug: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(visibleIds));
  };

  const groupSelectionState = (group: SpaceGroup): GroupSelectionState => {
    let selectedCount = 0;
    for (const d of group.drafts) {
      if (selected.has(d.id)) selectedCount++;
    }
    if (selectedCount === 0) return GroupSelectionState.None;
    if (selectedCount === group.drafts.length) return GroupSelectionState.All;
    return GroupSelectionState.Some;
  };

  const toggleGroupSelection = (group: SpaceGroup) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const state = groupSelectionState(group);
      if (state === GroupSelectionState.All) {
        for (const d of group.drafts) next.delete(d.id);
      } else {
        for (const d of group.drafts) next.add(d.id);
      }
      return next;
    });
  };

  const handleOpen = (group: SpaceGroup, draft: DraftChangeListItem) => {
    const params = new URLSearchParams({
      space: group.spaceSlug,
      file: draft.file_path,
    });
    navigate(`${Urls.Spaces}?${params.toString()}`);
  };

  const handleCommitSelected = () => {
    if (selected.size === 0) return;
    const message = trim(commitMessage);
    if (!message) {
      setError(t('changes.errorMessageRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    const idsBySpace = new Map<string, string[]>();
    for (const d of drafts) {
      if (!selected.has(d.id)) continue;
      const list = idsBySpace.get(d.space_id) ?? [];
      list.push(d.id);
      idsBySpace.set(d.space_id, list);
    }
    for (const ids of idsBySpace.values()) {
      commitDrafts(ids, message);
    }
  };

  const handleDiscardOne = (d: DraftChangeListItem) => {
    setBusy(true);
    discardDraft(d.id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(d.id);
      return next;
    });
  };

  const handleDiscardSelected = () => {
    if (selected.size === 0) return;
    setBusy(true);
    for (const id of selected) {
      discardDraft(id);
    }
    setSelected(new Set());
  };

  const totalLabelKey = total === 1 ? 'changes.totalLabel' : 'changes.totalLabel_plural';
  const discardSelectedKey =
    selected.size === 1
      ? 'changes.discardSelectedDraftsMessage'
      : 'changes.discardSelectedDraftsMessage_plural';

  return (
    <div className="h-full overflow-auto">
      <ConfirmDialog
        open={pendingDiscard !== null}
        title={t('changes.discardDraftTitle')}
        message={
          pendingDiscard
            ? t('changes.discardDraftMessage', { path: pendingDiscard.file_path })
            : ''
        }
        confirmLabel={t('common.discard')}
        danger
        onConfirm={() => {
          if (pendingDiscard) handleDiscardOne(pendingDiscard);
          setPendingDiscard(null);
        }}
        onCancel={() => setPendingDiscard(null)}
      />
      <ConfirmDialog
        open={pendingDiscardSelected}
        title={t('changes.discardSelectedDraftsTitle')}
        message={t(discardSelectedKey, { count: selected.size })}
        confirmLabel={t('common.discard')}
        danger
        onConfirm={() => {
          handleDiscardSelected();
          setPendingDiscardSelected(false);
        }}
        onCancel={() => setPendingDiscardSelected(false)}
      />
      <PageTitle title={t('changes.title')} subtitle={t('changes.subtitle')} />
      <div className="max-w-7xl p-6 space-y-4">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={typeFilter ?? ''}
              onChange={(e) => setTypeFilter(e.target.value === '' ? null : (e.target.value as EditChangeType))}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
            >
              <option value="">{t('changes.filterTypeAll')}</option>
              <option value={EditChangeType.Modify}>{t('changes.typeModified')}</option>
              <option value={EditChangeType.Create}>{t('changes.typeCreated')}</option>
              <option value={EditChangeType.Delete}>{t('changes.typeDeleted')}</option>
            </select>
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('changes.searchPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">{t('common.loading')}</div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="flex-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-destructive/20 text-destructive/70 hover:text-destructive"
              title={t('common.dismiss')}
              aria-label={t('changes.dismissError')}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {lastCommitPr && (
          <CommitPrBanner
            status={lastCommitPr.status}
            url={lastCommitPr.url}
            branch={lastCommitPr.branch}
            error={lastCommitPr.error}
            retrying={lastCommitPr.retrying}
            onRetry={() => {
              setLastCommitPr((prev) => (prev ? { ...prev, retrying: true } : prev));
              createPullRequest({ spaceId: lastCommitPr.spaceId });
            }}
            onDismiss={() => setLastCommitPr(null)}
          />
        )}

        {!loading && !error && total === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Edit3 size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('changes.emptyTitle')}</p>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-muted-foreground">
                {filteredTotal === total
                  ? t(totalLabelKey, { count: total })
                  : t('changes.shownLabel', { shown: filteredTotal, total })}
                {selected.size > 0 && ` · ${t('changes.selected', { count: selected.size })}`}
                {selectedSpaceCount > 1 && (
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                    · {t('changes.spansRepos', { count: selectedSpaceCount })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded text-muted-foreground hover:bg-accent"
                  disabled={visibleIds.length === 0}
                >
                  {allVisibleSelected ? <Check size={12} /> : <Square size={12} />}
                  {allVisibleSelected ? t('changes.deselectAll') : t('changes.selectAll')}
                </button>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={t('changes.commitPlaceholder')}
                  className="px-2 py-1 text-xs border border-border rounded bg-background text-foreground w-56"
                  disabled={selected.size === 0 || busy}
                  required
                />
                <button
                  type="button"
                  onClick={handleCommitSelected}
                  disabled={selected.size === 0 || busy || !trim(commitMessage)}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
                  title={
                    !trim(commitMessage)
                      ? t('changes.commitTitleEmpty')
                      : t('changes.commitTitle')
                  }
                >
                  <GitCommit size={12} />
                  {t('changes.commitButton')}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDiscardSelected(true)}
                  disabled={selected.size === 0 || busy}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
                  title={t('changes.discardSelectedTitle')}
                >
                  <Trash2 size={12} />
                  {t('changes.discardButton')}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {groups.map((group) => {
                const isOpen = expandedGroups.has(group.spaceSlug);
                const groupState = groupSelectionState(group);
                const groupCheckboxIcon =
                  groupState === GroupSelectionState.All ? (
                    <Check size={14} className="text-green-600" />
                  ) : groupState === GroupSelectionState.Some ? (
                    <Minus size={14} className="text-primary" />
                  ) : (
                    <Square size={14} className="text-muted-foreground" />
                  );
                return (
                  <div
                    key={group.spaceSlug}
                    className="border border-border rounded-lg bg-card overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-4 py-2 hover:bg-accent/50">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroupSelection(group);
                        }}
                        title={
                          groupState === GroupSelectionState.All
                            ? t('changes.deselectGroup', { space: group.spaceSlug })
                            : t('changes.selectGroup', { space: group.spaceSlug })
                        }
                        className="p-0.5 rounded hover:bg-accent flex-shrink-0"
                      >
                        {groupCheckboxIcon}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.spaceSlug)}
                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                      >
                        {isOpen ? (
                          <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                        )}
                        <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate flex-1">
                          {group.spaceSlug}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {group.drafts.length}
                        </span>
                      </button>
                    </div>

                    {isOpen && (
                      <ul className="divide-y divide-border border-t border-border">
                        {group.drafts.map((d) => {
                          const isSelected = selected.has(d.id);
                          return (
                            <li key={d.id}>
                              <div
                                className={`flex items-start gap-2 px-4 py-3 hover:bg-accent/40 ${
                                  isSelected ? 'bg-primary/5' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleOne(d.id)}
                                  className="p-0.5 rounded hover:bg-accent flex-shrink-0 mt-0.5"
                                  title={isSelected ? t('changes.deselectRow') : t('changes.selectRow')}
                                >
                                  {isSelected ? (
                                    <Check size={14} className="text-green-600" />
                                  ) : (
                                    <Square size={14} className="text-muted-foreground" />
                                  )}
                                </button>
                                <div className="flex-shrink-0 pt-0.5">
                                  {changeIcon(d.change_type)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpen(group, d)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-2 mb-0.5 text-sm">
                                    <span className="text-foreground truncate flex-1 hover:underline">
                                      {d.file_path}
                                    </span>
                                    <span
                                      className={`text-xs px-1.5 py-0.5 rounded ${changeBadgeClasses(d.change_type)}`}
                                    >
                                      {d.change_type}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>{formatDateTime(d.updated_at)}</span>
                                    {d.branch_id && <span>· {t('changes.branchLabel', { sha: d.branch_id.slice(0, 7) })}</span>}
                                    {d.description && (
                                      <span className="truncate">· {d.description}</span>
                                    )}
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDiscard(d)}
                                  disabled={busy}
                                  className="p-1 rounded text-destructive hover:bg-destructive/10 flex-shrink-0 disabled:opacity-40"
                                  title={t('changes.discardRowTitle')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <RecentCommitsPanel />
      </div>
    </div>
  );
}


export default ChangesPage;
