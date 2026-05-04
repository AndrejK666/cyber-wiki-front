/**
 * ViewModeSwitcher — toggle for FileViewMode (Preview / Source / Visual).
 *
 * Per FR cpt-cyberwiki-fr-live-edit (raw vs WYSIWYG-style toggle).
 */

import { useTranslation } from '@cyberfabric/react';
import { FileViewMode } from '@/app/api';

interface ViewModeOption {
  id: FileViewMode;
  labelKey: string;
  descriptionKey: string;
}

const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  {
    id: FileViewMode.Preview,
    labelKey: 'viewMode.preview',
    descriptionKey: 'viewMode.previewDescription',
  },
  {
    id: FileViewMode.Source,
    labelKey: 'viewMode.source',
    descriptionKey: 'viewMode.sourceDescription',
  },
  {
    id: FileViewMode.Visual,
    labelKey: 'viewMode.visual',
    descriptionKey: 'viewMode.visualDescription',
  },
];

interface ViewModeSwitcherProps {
  currentMode: FileViewMode;
  onModeChange: (mode: FileViewMode) => void;
  /** Restrict which modes are offered (defaults to all). */
  availableModes?: FileViewMode[];
}

export function ViewModeSwitcher({
  currentMode,
  onModeChange,
  availableModes,
}: ViewModeSwitcherProps) {
  const { t } = useTranslation();
  const options = availableModes
    ? VIEW_MODE_OPTIONS.filter((o) => availableModes.includes(o.id))
    : VIEW_MODE_OPTIONS;

  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5 rounded border border-border bg-muted">
      {options.map((option) => {
        const isActive = currentMode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onModeChange(option.id)}
            className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={t(option.descriptionKey)}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
