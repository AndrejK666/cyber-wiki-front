/**
 * CommitPrBanner — single banner with copy tailored to each PR-status
 * outcome that ChangesPage shows after a successful commit.
 *
 * Extracted from ChangesPage to keep the page slim. The branching for
 * palette/headline/subline lives here so future copy tweaks are one-line
 * and the silent "stale-pr-on-failed" failure mode that older two-banner
 * shapes had cannot recur.
 */

import { useTranslation } from '@cyberfabric/react';
import { AlertCircle, GitCommit, X } from 'lucide-react';
import { PRStatus } from '@/app/api';

interface CommitPrBannerProps {
  status: PRStatus;
  url: string | null;
  branch: string;
  error: string | null;
  retrying: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function CommitPrBanner({
  status,
  url,
  branch,
  error,
  retrying,
  onRetry,
  onDismiss,
}: CommitPrBannerProps) {
  const { t } = useTranslation();
  const palette =
    status === PRStatus.Created || status === PRStatus.Existing
      ? {
          border: 'border-blue-500/30',
          bg: 'bg-blue-500/10',
          icon: <GitCommit size={16} className="flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />,
          link: 'text-blue-600 dark:text-blue-400',
          dismissBg: 'hover:bg-blue-500/20',
        }
      : status === PRStatus.Failed
        ? {
            border: 'border-yellow-500/30',
            bg: 'bg-yellow-500/10',
            icon: <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />,
            link: 'text-yellow-700 dark:text-yellow-300',
            dismissBg: 'hover:bg-yellow-500/20',
          }
        : {
            border: 'border-muted-foreground/30',
            bg: 'bg-muted',
            icon: <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-muted-foreground" />,
            link: 'text-muted-foreground',
            dismissBg: 'hover:bg-accent',
          };

  const headline =
    status === PRStatus.Created
      ? t('commitPrBanner.headlineCreated', { branch })
      : status === PRStatus.Existing
        ? t('commitPrBanner.headlineExisting', { branch })
        : status === PRStatus.Failed
          ? t('commitPrBanner.headlineFailed')
          : t('commitPrBanner.headlineNotAttempted');

  const subline =
    status === PRStatus.Failed
      ? error
      : status === PRStatus.NotAttempted
        ? t('commitPrBanner.sublineFailedHelp')
        : null;

  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-md border ${palette.border} ${palette.bg} text-foreground text-sm`}
    >
      {palette.icon}
      <div className="flex-1 leading-relaxed">
        <p className="font-medium">{headline}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${palette.link} underline hover:no-underline break-all`}
          >
            {url}
          </a>
        )}
        {subline && (
          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
            {subline}
          </p>
        )}
        {status === PRStatus.Failed && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-500/20 disabled:opacity-50"
          >
            <GitCommit size={12} />
            {retrying ? t('commitPrBanner.retrying') : t('commitPrBanner.retry')}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={`flex-shrink-0 p-0.5 rounded ${palette.dismissBg} text-muted-foreground hover:text-foreground`}
        title={t('commitPrBanner.dismissTitle')}
        aria-label={t('commitPrBanner.dismissTitle')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
