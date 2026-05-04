/**
 * BlameView — git-blame style per-line gutter showing the commit, author
 * and date that introduced each line.
 *
 * Receives raw blame data plus the same `content` shown by FileRenderer so
 * lines without a blame entry (uncommitted appends past the blame range,
 * empty file response) still render. Consecutive same-commit lines are
 * collapsed in the gutter — only the first row in a run gets the full
 * "Author + sha + date" caption, the rest get an indented bar.
 */

import { useMemo } from 'react';
import { useTranslation } from '@cyberfabric/react';
import { GitCommit, Loader2 } from 'lucide-react';
import type { BlameLine } from '@/app/api';

interface BlameViewProps {
  /** Raw text of the file — single source of truth for the rendered rows so
   *  we don't desync against blame's own copy of `content`. */
  content: string;
  /** Per-line blame entries (1-based `line_no`). Empty when blame is loading
   *  or unsupported. */
  blame: BlameLine[];
  /** True while the blame fetch is still in flight. */
  loading?: boolean;
  /** Optional error to surface inline (e.g. file not in git yet). */
  error?: string | null;
  /** Provider didn't implement blame for this repo — show a neutral notice
   *  rather than the raw data area. */
  unsupported?: boolean;
}

const BLAME_GUTTER_WIDTH = 'w-72';

export default function BlameView({
  content,
  blame,
  loading,
  error,
  unsupported,
}: BlameViewProps) {
  const { t } = useTranslation();
  const lines = useMemo(() => {
    const normalized = content.replace(/\r\n/g, '\n');
    const parts = normalized.split('\n');
    if (normalized.endsWith('\n') && parts.length > 1) parts.pop();
    return parts;
  }, [content]);
  const blameByLine = useMemo(() => {
    const map = new Map<number, BlameLine>();
    for (const b of blame) map.set(b.line_no, b);
    return map;
  }, [blame]);

  // Per-row "is this the first line of its commit run" — drives whether the
  // gutter caption is repeated for the row.
  const isFirstOfRun = useMemo(() => {
    const flags: boolean[] = [];
    let prevSha = '';
    for (let i = 0; i < lines.length; i++) {
      const b = blameByLine.get(i + 1);
      const sha = b?.commit_sha ?? '';
      flags.push(sha !== prevSha);
      prevSha = sha;
    }
    return flags;
  }, [lines, blameByLine]);

  if (unsupported) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {t('blame.unsupported')}
      </div>
    );
  }

  if (loading && blame.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && blame.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="font-mono text-xs leading-relaxed select-text">
      {lines.map((text, idx) => {
        const lineNo = idx + 1;
        const b = blameByLine.get(lineNo);
        const showCaption = !!b && isFirstOfRun[idx];
        return (
          <div key={lineNo} className="flex items-stretch border-b border-border/30">
            {/* Blame gutter — caption only on first row of each commit run. */}
            <div
              className={`${BLAME_GUTTER_WIDTH} flex-shrink-0 px-3 py-0.5 text-[11px] border-r border-border bg-muted/40`}
              title={
                b
                  ? t('blame.blameTitleFormat', {
                      author: b.author_name,
                      email: b.author_email,
                      sha: b.commit_sha,
                      date: b.author_date,
                      summary: b.summary,
                    })
                  : t('blame.notCommittedTitle')
              }
            >
              {showCaption && b ? (
                <BlameCaption blame={b} />
              ) : b ? (
                <div className="h-4 border-l-2 border-border ml-1" aria-hidden />
              ) : (
                <span className="text-muted-foreground/60 italic">{t('blame.notCommitted')}</span>
              )}
            </div>

            {/* Line number column. */}
            <div className="w-10 flex-shrink-0 text-right pr-2 py-0.5 text-muted-foreground select-none">
              {lineNo}
            </div>

            {/* Line content. */}
            <pre className="flex-1 px-3 py-0.5 whitespace-pre-wrap break-all m-0 text-foreground">
              {text || ' '}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function BlameCaption({ blame }: { blame: BlameLine }) {
  const { t } = useTranslation();
  const shortSha = blame.commit_sha ? blame.commit_sha.slice(0, 8) : '—';
  const shortDate = formatBlameDate(blame.author_date);
  const author = blame.author_name || blame.author_email || t('blame.unknownAuthor');
  return (
    <div className="flex items-center gap-2 truncate text-foreground">
      <GitCommit size={10} className="text-muted-foreground flex-shrink-0" />
      <span className="font-medium truncate">{author}</span>
      <code className="text-[10px] text-muted-foreground">{shortSha}</code>
      <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
        {shortDate}
      </span>
    </div>
  );
}

function formatBlameDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // "12 Mar 2026" — short, locale-stable, no time noise (commit second-of-day
  // is rarely useful in a blame gutter).
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
