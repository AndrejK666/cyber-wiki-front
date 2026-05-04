/**
 * SmartLoadingIndicator — full-area spinner with optional message and
 * loaded-bytes counter. Pairs with `performanceTracker.getMetrics()` for slow
 * operations.
 *
 * Ported from doclab common/SmartLoadingIndicator.tsx.
 */

import { useTranslation } from '@cyberfabric/react';
import { Loader2 } from 'lucide-react';
import { formatBytes } from '@/app/lib/performanceTracker';

interface SmartLoadingIndicatorProps {
  message?: string;
  dataLoaded?: number;
  showDataSize?: boolean;
}

export function SmartLoadingIndicator({
  message,
  dataLoaded = 0,
  showDataSize = true,
}: SmartLoadingIndicatorProps) {
  const { t } = useTranslation();
  const text = message ?? t('loading.default');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Loader2 size={48} className="animate-spin text-primary" />
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">{text}</p>
        {showDataSize && dataLoaded > 0 && (
          <p className="text-xs text-muted-foreground/70">
            {t('loading.loadedSuffix', { size: formatBytes(dataLoaded) })}
          </p>
        )}
      </div>
    </div>
  );
}
