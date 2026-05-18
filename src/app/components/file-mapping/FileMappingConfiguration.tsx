/**
 * FileMappingConfiguration — full editor that wires together
 * FileMappingConfigPanel + FileMappingPreview, plus space-level filters,
 * default display-name source, and refresh / sync actions.
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventBus, useTranslation } from '@cyberfabric/react';
import { trim } from 'lodash';
import { BookOpen, Code, Plus, X } from 'lucide-react';
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
  // Config panel always renders the raw repo layout — sourced from dev mode.
  const [devTree, setDevTree] = useState<TreeNode[]>([]);
  // Preview pane shows the mapped + filtered result — sourced from documents mode.
  const [documentTree, setDocumentTree] = useState<TreeNode[]>([]);
  const [previewViewMode, setPreviewViewMode] = useState<ViewMode>(ViewMode.Documents);
  const [filters, setFilters] = useState<string[]>(space.filters || []);
  const [newFilter, setNewFilter] = useState('');
  const [defaultSource, setDefaultSource] = useState<DisplayNameSource>(
    (space.default_display_name_source as DisplayNameSource) || DisplayNameSource.FirstH1,
  );
  const [pendingSync, setPendingSync] = useState(false);

  // Keep the latest filter set in a ref so event-driven tree reloads pick up
  // the live value without re-subscribing on every change.
  const filtersRef = useRef<string[]>(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Scroll-position preservation: snapshot both panes before a tree reload
  // fires, restore on the next paint after the tree state lands.
  const configScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef<{ config: number; preview: number } | null>(null);

  const captureScroll = useCallback(() => {
    pendingScrollRef.current = {
      config: configScrollRef.current?.scrollTop ?? 0,
      preview: previewScrollRef.current?.scrollTop ?? 0,
    };
  }, []);

  const reloadTrees = useCallback(() => {
    captureScroll();
    // Dev tree is raw — load with no filters so users can configure everything.
    loadFileTree(space.slug, ViewMode.Dev, undefined, []);
    // Documents tree applies the current filters + mapping treatment.
    loadFileTree(space.slug, ViewMode.Documents, undefined, filtersRef.current);
  }, [captureScroll, space.slug]);

  // Subscribe to events + initial load. Mapping mutations / refresh / sync /
  // space updates bust both trees so labels and visibility stay in sync.
  useEffect(() => {
    const matchesSpace = (payload: { spaceSlug?: string }) => payload.spaceSlug === space.slug;
    const reloadIfMatch = (payload: { spaceSlug: string }) => {
      if (matchesSpace(payload)) reloadTrees();
    };
    const subs = [
      eventBus.on('wiki/file-mappings/loaded', (payload) => {
        if (matchesSpace(payload)) setMappings(payload.mappings);
      }),
      eventBus.on('wiki/tree/loaded', (payload) => {
        // Subtree splice (lazy-loaded folder children from wiki/git-tree/load).
        // Mirrors the SpaceViewPage splicer: normalise relative paths against
        // the requested parent path, then graft into the matching folder node.
        if (payload.path) {
          const parentPath = payload.path;
          const prefix = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
          const normalized = (payload.tree ?? []).map((child) => {
            const isAbsolute = child.path.startsWith(prefix);
            return {
              ...child,
              path: isAbsolute ? child.path : `${prefix}${child.path}`,
            };
          });
          const splice = (nodes: TreeNode[]): TreeNode[] =>
            nodes.map((n) => {
              if (n.path === parentPath) return { ...n, children: normalized };
              if (n.children && n.children.length > 0) {
                return { ...n, children: splice(n.children) };
              }
              return n;
            });
          setDevTree((prev) => splice(prev));
          setDocumentTree((prev) => splice(prev));
          return;
        }
        if (payload.mode === ViewMode.Dev) {
          setDevTree(payload.tree ?? []);
        } else if (payload.mode === ViewMode.Documents) {
          setDocumentTree(payload.tree ?? []);
        }
      }),
      eventBus.on('wiki/file-mapping/created', reloadIfMatch),
      eventBus.on('wiki/file-mapping/updated', reloadIfMatch),
      eventBus.on('wiki/file-mapping/deleted', reloadIfMatch),
      eventBus.on('wiki/file-mapping/folder-rule-applied', reloadIfMatch),
      eventBus.on('wiki/file-mappings/refreshed', reloadIfMatch),
      eventBus.on('wiki/file-mappings/synced', reloadIfMatch),
      eventBus.on('wiki/space/updated', ({ space: updated }) => {
        if (updated.slug === space.slug) reloadTrees();
      }),
    ];
    loadFileMappings(space.slug);
    // Initial dev-mode load. Documents-mode load is triggered by the filter
    // effect below (which also fires on mount with the current filters).
    loadFileTree(space.slug, ViewMode.Dev, undefined, []);
    return () => {
      subs.forEach((s) => s.unsubscribe());
    };
  }, [space.slug, reloadTrees]);

  // Reload preview tree whenever the active filter set changes.
  useEffect(() => {
    loadFileTree(space.slug, ViewMode.Documents, undefined, filters);
  }, [space.slug, filters]);

  // After either tree state lands, restore the scroll positions captured
  // right before the reload was triggered (no-op when nothing was queued).
  useEffect(() => {
    const queued = pendingScrollRef.current;
    if (!queued) return;
    if (configScrollRef.current) configScrollRef.current.scrollTop = queued.config;
    if (previewScrollRef.current) previewScrollRef.current.scrollTop = queued.preview;
    pendingScrollRef.current = null;
  }, [devTree, documentTree]);

  // Index mappings by path (without trailing slash) so the config panel can
  // look up the current row state.
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

        {/* Two-column settings row: editor side (defaults + filters) | preview side (label + view mode) */}
        <div className="flex border-b border-border bg-muted shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-x-6 gap-y-2 flex-wrap p-4 border-r border-border">
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

          <div className="w-96 shrink-0 flex items-center justify-between gap-2 p-4">
            <h3 className="text-sm font-semibold text-foreground">{t('fileMappingPreview.title')}</h3>
            <div className="flex gap-0.5 p-0.5 rounded bg-background">
              <button
                type="button"
                onClick={() => setPreviewViewMode(ViewMode.Documents)}
                className={`p-1 rounded transition-colors ${
                  previewViewMode === ViewMode.Documents
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
                aria-label={t('fileMappingPreview.documentsView')}
                title={t('fileMappingPreview.documentsView')}
              >
                <BookOpen size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewMode(ViewMode.Dev)}
                className={`p-1 rounded transition-colors ${
                  previewViewMode === ViewMode.Dev
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
                aria-label={t('fileMappingPreview.developerView')}
                title={t('fileMappingPreview.developerView')}
              >
                <Code size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Two-pane editor — both trees start at the same vertical position. */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div ref={configScrollRef} className="flex-1 min-w-0 border-r border-border overflow-auto">
            <FileMappingConfigPanel
              space={space}
              spaceDefaultSource={defaultSource}
              tree={devTree}
              mappings={mappingsByPath}
            />
          </div>
          <div ref={previewScrollRef} className="w-96 shrink-0 overflow-auto">
            <FileMappingPreview
              viewMode={previewViewMode}
              documentTree={documentTree}
              devTree={devTree}
            />
          </div>
        </div>
      </div>
    </>
  );
}
