/**
 * PRsPage — global list of open PRs across all visible spaces.
 * Supports filtering by author, reviewer, and free-text search.
 */

import { useEffect, useMemo, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { lowerCase, trim } from 'lodash';
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  GitPullRequest,
  MessageSquare,
  Search,
  User,
} from 'lucide-react';
import { loadPullRequests } from '@/app/actions/wikiActions';
import { PageTitle } from '@/app/layout';
import { Urls, type MyReviewPR, type PRReviewer } from '@/app/api';
import { formatDate } from '@/app/lib/formatDate';

interface PRsPageProps {
  navigate: (view: string) => void;
}

interface SpaceGroup {
  spaceSlug: string;
  spaceName: string;
  prs: MyReviewPR[];
}

function groupBySpace(prs: MyReviewPR[]): SpaceGroup[] {
  const map = new Map<string, SpaceGroup>();
  for (const pr of prs) {
    let group = map.get(pr.space_slug);
    if (!group) {
      group = { spaceSlug: pr.space_slug, spaceName: pr.space_name, prs: [] };
      map.set(pr.space_slug, group);
    }
    group.prs.push(pr);
  }
  for (const g of map.values()) {
    g.prs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return Array.from(map.values()).sort((a, b) => a.spaceSlug.localeCompare(b.spaceSlug));
}

function ReviewerChip({ reviewer }: { reviewer: PRReviewer }) {
  const isApproved = reviewer.status === 'APPROVED';
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-accent"
      title={`${reviewer.display_name || reviewer.username} — ${reviewer.status}`}
    >
      {reviewer.avatar_url ? (
        <img src={reviewer.avatar_url} alt="" className="w-4 h-4 rounded-full" />
      ) : (
        <User size={10} className="text-muted-foreground" />
      )}
      <span className="text-foreground">{reviewer.display_name || reviewer.username}</span>
      {isApproved ? (
        <Check size={10} className="text-green-600" />
      ) : (
        <Clock size={10} className="text-yellow-600" />
      )}
    </span>
  );
}

function collectAuthors(prs: MyReviewPR[]): string[] {
  const set = new Set<string>();
  for (const pr of prs) {
    if (pr.author) set.add(pr.author);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function isBot(username: string, botPrefixes: string[]): boolean {
  const lower = lowerCase(username);
  return botPrefixes.some((prefix) => lower.startsWith(lowerCase(prefix)));
}

function collectReviewers(prs: MyReviewPR[], botPrefixes: string[]): string[] {
  const set = new Set<string>();
  for (const pr of prs) {
    for (const r of pr.reviewers) {
      if (r.username && !isBot(r.username, botPrefixes)) set.add(r.username);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function PRsPage({ navigate }: PRsPageProps) {
  const { t } = useTranslation();
  const [prs, setPrs] = useState<MyReviewPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [reviewerFilter, setReviewerFilter] = useState('me');
  const [currentGitUsernames, setCurrentGitUsernames] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [botUsernames, setBotUsernames] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const loadedSub = eventBus.on('wiki/my-reviews/loaded', ({ pullRequests, currentGitUsernames: usernames, botUsernames: bots }) => {
      setPrs(pullRequests);
      setCurrentGitUsernames(usernames);
      setBotUsernames(bots);
      setLoading(false);
      const slugs = new Set(pullRequests.map((pr) => pr.space_slug));
      setExpandedGroups(slugs);
    });
    const errorSub = eventBus.on('wiki/my-reviews/error', ({ error: msg }) => {
      setError(msg);
      setLoading(false);
    });

    loadPullRequests();

    return () => {
      loadedSub.unsubscribe();
      errorSub.unsubscribe();
    };
  }, []);

  const authors = useMemo(() => collectAuthors(prs), [prs]);
  const reviewers = useMemo(() => collectReviewers(prs, botUsernames), [prs, botUsernames]);

  const groups = useMemo(() => {
    const q = lowerCase(trim(search));
    const filtered = prs.filter((pr) => {
      if (authorFilter !== 'all' && pr.author !== authorFilter) return false;
      if (reviewerFilter === 'me') {
        const meSet = new Set(currentGitUsernames.map((u) => lowerCase(u)));
        const hasMe = pr.reviewers.some((r) => meSet.has(lowerCase(r.username)));
        if (!hasMe) return false;
      } else if (reviewerFilter !== 'all') {
        const hasReviewer = pr.reviewers.some((r) => r.username === reviewerFilter);
        if (!hasReviewer) return false;
      }
      if (q) {
        const match =
          lowerCase(pr.title).includes(q) ||
          lowerCase(pr.author).includes(q) ||
          lowerCase(pr.space_slug).includes(q) ||
          lowerCase(pr.space_name).includes(q) ||
          String(pr.number).includes(q);
        if (!match) return false;
      }
      return true;
    });
    return groupBySpace(filtered);
  }, [prs, search, authorFilter, reviewerFilter, currentGitUsernames]);

  const total = prs.length;
  const filteredTotal = groups.reduce((sum, g) => sum + g.prs.length, 0);

  const toggleGroup = (slug: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleOpenSpace = (spaceSlug: string) => {
    navigate(`${Urls.Spaces}?space=${spaceSlug}`);
  };

  const totalLabelKey = total === 1 ? 'prs.totalLabel' : 'prs.totalLabel_plural';

  return (
    <div className="h-full overflow-auto">
      <PageTitle title={t('prs.title')} subtitle={t('prs.subtitle')} />
      <div className="max-w-7xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('prs.searchPlaceholder')}
              placeholder={t('prs.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
              aria-label={t('prs.filterAuthor')}
              title={t('prs.filterAuthor')}
            >
              <option value="all">{t('prs.authorAll')}</option>
              {authors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={reviewerFilter}
              onChange={(e) => setReviewerFilter(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
              aria-label={t('prs.filterReviewer')}
              title={t('prs.filterReviewer')}
            >
              <option value="me">{t('prs.reviewerMine')}</option>
              <option value="all">{t('prs.reviewerAll')}</option>
              {reviewers.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            <GitPullRequest size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('prs.emptyTitle')}</p>
            <p className="text-xs mt-1">{t('prs.emptyHint')}</p>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <>
            <div className="text-xs text-muted-foreground">
              {filteredTotal === total
                ? t(totalLabelKey, { count: total })
                : t('prs.shownLabel', { shown: filteredTotal, total })}
            </div>

            <div className="space-y-2">
              {groups.map((group) => {
                const isOpen = expandedGroups.has(group.spaceSlug);
                return (
                  <div
                    key={group.spaceSlug}
                    className="border border-border rounded-lg bg-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.spaceSlug)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent/50 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <GitPullRequest size={14} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate flex-1">
                        {group.spaceName || group.spaceSlug}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {group.prs.length}
                      </span>
                    </button>

                    {isOpen && (
                      <ul className="divide-y divide-border border-t border-border">
                        {group.prs.map((pr) => (
                          <li key={pr.number}>
                            <div className="flex items-start gap-3 px-4 py-3 hover:bg-accent/40">
                              <GitPullRequest size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-foreground truncate">
                                    {pr.title}
                                  </span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground flex-shrink-0">
                                    #{pr.number}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  <span>{t('prs.byAuthor', { author: pr.author })}</span>
                                  {pr.from_branch && <span>· {pr.from_branch}</span>}
                                  <span>· {formatDate(pr.created_at)}</span>
                                </div>
                                {pr.reviewers.length > 0 && (() => {
                                  const humans = pr.reviewers.filter((r) => !isBot(r.username, botUsernames));
                                  const bots = pr.reviewers.filter((r) => isBot(r.username, botUsernames));
                                  return (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {humans.map((r) => (
                                        <ReviewerChip key={r.username} reviewer={r} />
                                      ))}
                                      {bots.length > 0 && (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                                          title={bots.map((b) => b.display_name || b.username).join(', ')}
                                        >
                                          <Bot size={10} />
                                          <span>{t('prs.botReviewers')} ({bots.length})</span>
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {(() => {
                                  const hasBreakdown = pr.human_comment_count != null || pr.bot_comment_count != null;
                                  const human = pr.human_comment_count ?? 0;
                                  const bot = pr.bot_comment_count ?? 0;
                                  const total = pr.comment_count ?? 0;
                                  if (hasBreakdown) {
                                    return (
                                      <>
                                        {human > 0 && (
                                          <a
                                            href={pr.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-accent text-accent-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                            title={t('prs.viewComments')}
                                          >
                                            <MessageSquare size={12} />
                                            <span>{human}</span>
                                          </a>
                                        )}
                                        {bot > 0 && (
                                          <a
                                            href={pr.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                                            title={t(bot === 1 ? 'prs.botComment' : 'prs.botComment_plural', { count: bot })}
                                          >
                                            <Bot size={12} />
                                            <span>{bot}</span>
                                          </a>
                                        )}
                                      </>
                                    );
                                  }
                                  if (total > 0) {
                                    return (
                                      <a
                                        href={pr.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-accent text-accent-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                        title={t('prs.viewComments')}
                                      >
                                        <MessageSquare size={12} />
                                        <span>{total}</span>
                                      </a>
                                    );
                                  }
                                  return null;
                                })()}
                                <button
                                  type="button"
                                  onClick={() => handleOpenSpace(group.spaceSlug)}
                                  className="text-xs text-primary hover:underline"
                                  title={t('prs.openSpace')}
                                >
                                  {t('prs.openSpace')}
                                </button>
                                {pr.url && (
                                  <a
                                    href={pr.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                    title={t('prs.openInProvider')}
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
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

export default PRsPage;
