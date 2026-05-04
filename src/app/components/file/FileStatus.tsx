/**
 * FileStatus — full-area status placeholder shown in place of file content
 * when fetching it failed. `code` is an HTTP status when known (the git
 * provider rejected the request), or `null` for the generic "looks
 * unhappy" fallback.
 *
 * Used by `FileViewer` instead of dumping the upstream error page or a
 * thin red banner.
 */

import { useTranslation } from '@cyberfabric/react';
import { FileX, Lock, ShieldOff } from 'lucide-react';
import { Urls } from '@/app/api';
import { HttpStatus } from '@/app/lib/httpStatus';

interface FileStatusProps {
  /** Upstream HTTP status; `null` renders the generic message. */
  code: HttpStatus | null;
  /** Free-form details from the upstream response. Rendered as a small
   *  monospace footnote so the user can paste it into a bug report; not
   *  shown when the canned description is enough. */
  detail?: string | null;
  /** Optional global navigate (so the action button can link to Tokens). */
  navigate?: (view: string) => void;
}

const STATUS_KEY: Record<HttpStatus, string> = {
  [HttpStatus.Unauthorized]: 'fileStatus.401',
  [HttpStatus.Forbidden]: 'fileStatus.403',
  [HttpStatus.NotFound]: 'fileStatus.404',
};

const GENERIC_KEY = 'fileStatus.generic';

function StatusIcon({ code }: { code: HttpStatus | null }) {
  const className = 'w-12 h-12 text-muted-foreground/60';
  if (code === HttpStatus.Unauthorized) return <Lock className={className} />;
  if (code === HttpStatus.Forbidden) return <ShieldOff className={className} />;
  return <FileX className={className} />;
}

export function FileStatus({ code, detail, navigate }: FileStatusProps) {
  const { t } = useTranslation();
  const base = (code !== null && STATUS_KEY[code]) ?? GENERIC_KEY;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
      <StatusIcon code={code} />
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        {t(`${base}.title`)}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t(`${base}.description`)}
      </p>
      {code === HttpStatus.Unauthorized && navigate && (
        <button
          type="button"
          onClick={() => navigate(Urls.Tokens)}
          className="mt-4 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t('fileStatus.401.action')}
        </button>
      )}
      {detail && (
        <pre className="mt-6 max-w-2xl px-3 py-2 rounded-md bg-muted text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-words text-left">
          {detail}
        </pre>
      )}
    </div>
  );
}
