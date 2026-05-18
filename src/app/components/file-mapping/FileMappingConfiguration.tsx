/**
 * FileMappingConfiguration — full editor that wires together
 * FileMappingConfigPanel + FileMappingPreview, plus space-level filters,
 * default display-name source, and refresh / sync actions.
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 *
 * Inspired by doclab components/spaces/file-mapping/FileMappingConfiguration.tsx.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { trim } from 'lodash';
import { Plus, X } from 'lucide-react';
import { FileMappingConfigPanel } from '@/app/components/file-mapping/FileMappingConfigPanel';
import { FileMappingPreview } from '@/app/components/file-mapping/FileMappingPreview';
import { ConfirmDialog } from '@/app/components/primitives/ConfirmDialog';
import {
  loadFileMappings,
  refreshFileMappings,
  syncFileMappings,
} from '@/app/actions/fileMappingActions';
import { loadFileTree, updateSpace } from '@/app/actions/wikiActions';
import {
  DisplayNameSource,
  ViewMode,
  type FileMapping,
  type Space,
  type TreeNode,
} from '@/app/api';

const SPACE_DEFAULT_OPTIONS: Array<{ value: DisplayNameSource; labelKey: string }> = [
  { value: DisplayNameSource.FirstH1, labelKey: 'fileMapping.sourceH1' },
  { value: DisplayNameSource.FirstH2, labelKey: 'fileMapping.sourceH2' },
  { value: DisplayNameSource.TitleFrontmatter, labelKey: 'fileMapping.sourceFrontmatter' },
  { value: DisplayNameSource.Filename, labelKey: 'fileMapping.sourceFilename' },
];

interface FileMappingConfigurationProps {
  space: Space;
  onClose: () => void;
}

export function FileMappingConfiguration({ space, onClose }: FileMappingConfigurationProps) {
  const { t } = useTranslation();
  const [mappings, setMappings] = useState<FileMapping[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [filters, setFilters] = useState<string[]>(space.filters || []);
  const [newFilter, setNewFilter] = useState('');
  const [defaultSource, setDefaultSource] = useState<DisplayNameSource>(
    (space.default_display_name_source as DisplayNameSource) || DisplayNameSource.FirstH1,
  );
  const [pendingSync, setPendingSync] = useState(false);

  // Subscribe to events + initial load
  useEffect(() => {
    const subs = [
      eventBus.on('wiki/file-mappings/loaded', (payload) => {
        if (payload.spaceSlug === space.slug) {
          setMappings(payload.mappings);
        }
      }),
      eventBus.on('wiki/tree/loaded', (payload) => {
        setTree(payload.tree ?? []);
      }),
    ];
    loadFileMappings(space.slug);
    return () => {
      subs.forEach((s) => s.unsubscribe());
    };
  }, [space.slug]);

  // Reload tree whenever the active filter set changes (initial mount uses the
  // space's persisted filters; subsequent reloads use the optimistic local state).
  useEffect(() => {
    loadFileTree(space.slug, ViewMode.Documents, undefined, filters);
  }, [space.slug, filters]);

  // Index mappings by path (without trailing slash)
  const mappingsByPath = useMemo(() => {
    const map = new Map<string, FileMapping>();
    for (const m of mappings) {
      map.set(m.file_path.replace(/\/$/, ''), m);
    }
    return map;
  }, [mappings]);

  const persistFilters = useCallback(
    (next: string[]) => {
      setFilters(next);
      updateSpace(space.slug, { filters: next } as never);
    },
    [space.slug],
  );

  const handleAddFilter = useCallback(() => {
    const value = trim(newFilter);
    if (!value || filters.includes(value)) return;
    persistFilters([...filters, value]);
    setNewFilter('');
  }, [filters, newFilter, persistFilters]);

  const handleRemoveFilter = useCallback(
    (filter: string) => {
      persistFilters(filters.filter((f) => f !== filter));
    },
    [filters, persistFilters],
  );

  const handleChangeDefault = useCallback(
    (next: DisplayNameSource) => {
      setDefaultSource(next);
      updateSpace(space.slug, { default_display_name_source: next } as never);
    },
    [space.slug],
  );

  return (
    <>
      <ConfirmDialog
        open={pendingSync}
        title={t('fileMapping.syncConfirmTitle')}
        message={t('fileMapping.syncConfirmMessage')}
        confirmLabel={t('fileMapping.sync')}
        onConfirm={() => {
          syncFileMappings(space.slug);
          setPendingSync(false);
        }}
        onCancel={() => setPendingSync(false)}
      />

      <div className="flex flex-col h-[90vh] w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">{t('fileMapping.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshFileMappings(space.slug)}
              className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
              title={t('fileMapping.refreshTitle')}
            >
              {t('fileMapping.refresh')}
            </button>
            <button
              type="button"
              onClick={() => setPendingSync(true)}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              title={t('fileMapping.syncTitle')}
            >
              {t('fileMapping.sync')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-accent rounded text-muted-foreground"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Space-wide settings — single row */}
        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap p-4 border-b border-border bg-muted shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-foreground">{t('fileMapping.spaceDefault')}</span>
            <select
              value={defaultSource}
              onChange={(e) => handleChangeDefault(e.target.value as DisplayNameSource)}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground"
            >
              {SPACE_DEFAULT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground hidden xl:inline">
              {t('fileMapping.spaceDefaultHint')}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground shrink-0">{t('fileMapping.filters')}</span>
            {filters.map((filter) => (
              <span
                key={filter}
                className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300 rounded text-sm flex items-center gap-1"
              >
                {filter}
                <button
                  type="button"
                  onClick={() => handleRemoveFilter(filter)}
                  className="hover:opacity-80"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={newFilter}
              onChange={(e) => setNewFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFilter();
                }
              }}
              placeholder={t('fileMapping.filterPlaceholder')}
              className="px-2 py-1 border border-border rounded text-sm w-24 bg-background text-foreground"
            />
            <button
              type="button"
              onClick={handleAddFilter}
              className="p-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Two-pane editor */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 border-r border-border overflow-auto">
            <FileMappingConfigPanel
              spaceSlug={space.slug}
              tree={tree}
              mappings={mappingsByPath}
            />
          </div>
          <div className="w-96 shrink-0 overflow-auto">
            <FileMappingPreview documentTree={tree} />
          </div>
        </div>
      </div>
    </>
  );
}
