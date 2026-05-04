/**
 * CommentsPage — global list of every comment the user can see, grouped by
 * source URI. Click a row → navigate to the file and pre-select the line.
 */

import { useEffect, useMemo, useState } from 'react';
import { eventBus, useAppSelector, useTranslation, type HeaderUser } from '@cyberfabric/react';
import { lowerCase, trim } from 'lodash';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Filter,
  MessageSquare,
} from 'lucide-react';
import { loadAllComments } from '@/app/actions/enrichmentActions';
import { loadSpaces } from '@/app/actions/wikiActions';
import { PageTitle } from '@/app/layout';
import { Urls, buildSourceUri, type CommentData, type Space } from '@/app/api';
import { formatDate } from '@/app/lib/formatDate';

interface CommentsPageProps {
  navigate: (view: string) => void;
}

enum FilterMode {
  All = 'all',
  Open = 'open',
  Resolved = 'resolved',
}

interface SourceGroup {
  sourceUri: string;
  spaceSlug: string | null;
  filePath: string;
  comments: CommentData[];
}

function parseSourceUri(uri: string, spaces: Space[]): { spaceSlug: string | null; filePath: string } {
  const match = /^git:\/\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) {
    const exact = spaces.find((s) => buildSourceUri(s, uri) === uri);
    return { spaceSlug: exact?.slug ?? null, filePath: uri };
  }
  const [, provider, repoBlob, , filePath] = match;
  const exact = spaces.find((s) => buildSourceUri(s, filePath) === uri);
  if (exact) return { spaceSlug: exact.slug, filePath };
  const lenient = spaces.find((s) => {
    const repo = `${s.git_project_key ?? ''}_${s.git_repository_id ?? ''}`;
    return (s.git_provider ?? 'local_git') === provider && repo === repoBlob;
  });
  if (lenient) return { spaceSlug: lenient.slug, filePath };
  const repoSlug = repoBlob.includes('_') ? repoBlob.slice(repoBlob.lastIndexOf('_') + 1) : repoBlob;
  const byRepo = spaces.find((s) => {
    return (s.git_provider ?? 'local_git') === provider && s.git_repository_id === repoSlug;
  });
  return { spaceSlug: byRepo?.slug ?? null, filePath };
}

function groupBySource(comments: CommentData[], spaces: Space[]): SourceGroup[] {
  const map = new Map<string, SourceGroup>();
  for (const c of comments) {
    let group = map.get(c.source_uri);
    if (!group) {
      const { spaceSlug, filePath } = parseSourceUri(c.source_uri, spaces);
      group = { sourceUri: c.source_uri, spaceSlug, filePath, comments: [] };
      map.set(c.source_uri, group);
    }
    group.comments.push(c);
  }
  for (const g of map.values()) {
    g.comments.sort((a, b) => {
      const la = a.line_start ?? 0;
      const lb = b.line_start ?? 0;
      if (la !== lb) return la - lb;
      return b.created_at.localeCompare(a.created_at);
    });
  }
  return Array.from(map.values()).sort((a, b) => a.filePath.localeCompare(b.filePath));
}

function CommentsPage({ navigate }: CommentsPageProps) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>(FilterMode.All);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string>('all');

  const headerState = useAppSelector(
    (state) => state['layout/header'] as { user?: HeaderUser } | undefined,
  );
  const currentUsername = headerState?.user?.email?.split('@')[0] ?? null;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const loadedSub = eventBus.on('wiki/comments/all/loaded', ({ comments: list }) => {
      setComments(list);
      setLoading(false);
    });
    const errorSub = eventBus.on('wiki/comment/error', ({ error: msg }) => {
      setError(msg);
      setLoading(false);
    });
    const spacesSub = eventBus.on('wiki/spaces/loaded', (payload) => {
      setSpaces(payload.all);
    });
    loadAllComments(
      filter === FilterMode.Open
        ? { isResolved: false }
        : filter === FilterMode.Resolved
          ? { isResolved: true }
          : {},
    );
    loadSpaces();
    return () => {
      loadedSub.unsubscribe();
      errorSub.unsubscribe();
      spacesSub.unsubscribe();
    };
  }, [filter]);

  const authors = useMemo(() => {
    const set = new Set<string>();
    for (const c of comments) {
      if (c.author_username) set.add(c.author_username);
    }
    return Array.from(set).sort();
  }, [comments]);

  const groups = useMemo(() => {
    const q = lowerCase(trim(search));
    const filtered = comments.filter((c) => {
      if (authorFilter === 'mine') {
        if (!currentUsername || c.author_username !== currentUsername) return false;
      } else if (authorFilter !== 'all') {
        if (c.author_username !== authorFilter) return false;
      }
      if (!q) return true;
      return (
        lowerCase(c.text).includes(q) ||
        lowerCase(c.source_uri).includes(q) ||
        lowerCase(c.author_username || '').includes(q)
      );
    });
    return groupBySource(filtered, spaces);
  }, [comments, search, spaces, authorFilter, currentUsername]);

  const total = comments.length;
  const filteredTotal = groups.reduce((sum, g) => sum + g.comments.length, 0);

  const toggleGroup = (uri: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  };

  const handleOpen = (group: SourceGroup, comment: CommentData) => {
    if (!group.spaceSlug) {
      navigate(Urls.Spaces);
      return;
    }
    const params = new URLSearchParams({
      space: group.spaceSlug,
      file: group.filePath,
      comments: '1',
      source_uri: group.sourceUri,
    });
    if (comment.line_start) {
      params.set('line', String(comment.line_start));
    }
    navigate(`${Urls.Spaces}?${params.toString()}`);
  };

  const totalKey = total === 1 ? 'comments.totalLabel' : 'comments.totalLabel_plural';

  return (
    <div className="h-full overflow-auto">
      <PageTitle title={t('comments.title')} subtitle={t('comments.subtitle')} />
      <div className="max-w-7xl p-6 space-y-4">
        <div className="flex items-center justify-end flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
              title={t('comments.filterAuthor')}
            >
              <option value="all">{t('comments.authorAll')}</option>
              {currentUsername && <option value="mine">{t('comments.authorMine')}</option>}
              {authors.length > 0 && <option disabled>{t('comments.authorSeparator')}</option>}
              {authors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterMode)}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
              title={t('comments.filterStatus')}
            >
              <option value={FilterMode.All}>{t('comments.statusAll')}</option>
              <option value={FilterMode.Open}>{t('comments.statusOpen')}</option>
              <option value={FilterMode.Resolved}>{t('comments.statusResolved')}</option>
            </select>
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('comments.searchPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">{t('common.loading')}</div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {!loading && !error && total === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('comments.emptyTitle')}</p>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <>
            <div className="text-xs text-muted-foreground">
              {filteredTotal === total
                ? t(totalKey, { count: total })
                : t('comments.shownLabel', { shown: filteredTotal, total })}
            </div>

            <div className="space-y-2">
              {groups.map((group) => {
                const isOpen = expandedGroups.has(group.sourceUri);
                return (
                  <div
                    key={group.sourceUri}
                    className="border border-border rounded-lg bg-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.sourceUri)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent/50 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate flex-1">
                        {group.filePath}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {group.comments.length}
                      </span>
                    </button>

                    {isOpen && (
                      <ul className="divide-y divide-border border-t border-border">
                        {group.comments.map((c) => {
                          const replyCount = c.replies?.length ?? 0;
                          const replyKey = replyCount === 1 ? 'comments.reply' : 'comments.reply_plural';
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => handleOpen(group, c)}
                                className="w-full text-left px-4 py-3 hover:bg-accent/40"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-shrink-0 text-xs font-mono text-muted-foreground pt-0.5 w-12">
                                    {c.line_start ? t('comments.line', { line: c.line_start }) : t('comments.doc')}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-xs font-medium text-foreground">
                                        {c.author_username || t('comments.unknownAuthor')}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatDate(c.created_at)}
                                      </span>
                                      {c.is_resolved && (
                                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300">
                                          <CheckCircle2 size={10} />
                                          {t('comments.resolved')}
                                        </span>
                                      )}
                                      {replyCount > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          · {t(replyKey, { count: replyCount })}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-foreground line-clamp-2">{c.text}</p>
                                  </div>
                                </div>
                              </button>
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
      </div>
    </div>
  );
}

export default CommentsPage;
