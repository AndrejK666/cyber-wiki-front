/**
 * FileMappingConfigPanel — per-file editor for visibility and display-name
 * source. Renders the space's raw repo tree and overlays controls per row:
 *   - visibility checkbox (with cascade-from-parent honored)
 *   - "Display As" dropdown (per-file source)
 *   - inheritance status badge (← H1 (parent) / ← H1 (space) / Override)
 *   - "For Children" dropdown (folders only) — sets children_display_name_source
 *   - Custom name input (when source = custom)
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@cyberfabric/react';
import { FileTree } from '@/app/components/file/FileTree';
import {
  createFileMapping,
  updateFileMapping,
} from '@/app/actions/fileMappingActions';
import { loadFileTree } from '@/app/actions/wikiActions';
import {
  DisplayNameSource,
  TreeNodeType,
  ViewMode,
  type FileMapping,
  type Space,
  type TreeNode,
} from '@/app/api';

const FILE_SOURCE_OPTIONS: Array<{ value: DisplayNameSource | ''; labelKey: string }> = [
  { value: '', labelKey: 'fileMappingConfigPanel.sourceInherit' },
  { value: DisplayNameSource.FirstH1, labelKey: 'fileMappingConfigPanel.sourceH1' },
  { value: DisplayNameSource.FirstH2, labelKey: 'fileMappingConfigPanel.sourceH2' },
  { value: DisplayNameSource.TitleFrontmatter, labelKey: 'fileMappingConfigPanel.sourceFrontmatter' },
  { value: DisplayNameSource.Filename, labelKey: 'fileMappingConfigPanel.sourceFilename' },
  { value: DisplayNameSource.Custom, labelKey: 'fileMappingConfigPanel.sourceCustom' },
];

const FOLDER_SOURCE_OPTIONS: Array<{ value: DisplayNameSource | ''; labelKey: string }> = [
  { value: DisplayNameSource.Filename, labelKey: 'fileMappingConfigPanel.sourceFilename' },
  { value: DisplayNameSource.Custom, labelKey: 'fileMappingConfigPanel.sourceCustom' },
];

const CHILDREN_SOURCE_OPTIONS: Array<{ value: DisplayNameSource | ''; labelKey: string }> = [
  { value: '', labelKey: 'fileMappingConfigPanel.childrenInherit' },
  { value: DisplayNameSource.FirstH1, labelKey: 'fileMappingConfigPanel.sourceH1' },
  { value: DisplayNameSource.FirstH2, labelKey: 'fileMappingConfigPanel.sourceH2' },
  { value: DisplayNameSource.TitleFrontmatter, labelKey: 'fileMappingConfigPanel.sourceFrontmatter' },
  { value: DisplayNameSource.Filename, labelKey: 'fileMappingConfigPanel.sourceFilename' },
];

interface ResolvedConfig {
  source: DisplayNameSource | 'filename';
  isInherited: boolean;
  /** Path of the parent folder we inherit from, or `'space'` for space default. */
  inheritedFrom: string | null;
  isVisible: boolean;
  /** True if a parent folder is hidden (the row is forced hidden). */
  hiddenByParent: boolean;
  childrenSource: DisplayNameSource | null;
}

interface FileMappingConfigPanelProps {
  space: Space;
  spaceDefaultSource: DisplayNameSource;
  tree: TreeNode[];
  /** Mappings indexed by `file_path` (no trailing slash). */
  mappings: Map<string, FileMapping>;
}

export function FileMappingConfigPanel({
  space,
  spaceDefaultSource,
  tree,
  mappings,
}: FileMappingConfigPanelProps) {
  const spaceSlug = space.slug;
  // Controlled expansion lets us lazy-load subfolder children on first expand.
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const handleToggleFolder = useCallback(
    (node: TreeNode, willBeOpen: boolean) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (willBeOpen) {
          next.add(node.path);
          if (!node.children || node.children.length === 0) {
            // Lazy-load via the wiki get_tree endpoint (same one used for the
            // root load) — the bare /git-provider/v1/tree endpoint rejects
            // requests when the service-token's stored base_url doesn't match
            // the query param exactly. Dev mode + no filters mirrors the
            // initial root load for the config panel.
            loadFileTree(space.slug, ViewMode.Dev, node.path, []);
          }
        } else {
          next.delete(node.path);
        }
        return next;
      });
    },
    [space],
  );
  const { t } = useTranslation();
  const isFolderPath = (node: TreeNode) => node.type === TreeNodeType.Dir;

  // Build a path → mapping lookup that accepts both `path` and `path/` for
  // folders, mirroring how the backend resolves inheritance.
  const lookup = useMemo(() => {
    const map = new Map<string, FileMapping>(mappings);
    for (const m of mappings.values()) {
      if (m.is_folder) {
        map.set(m.file_path.replace(/\/$/, ''), m);
        map.set(m.file_path.replace(/\/$/, '') + '/', m);
      }
    }
    return map;
  }, [mappings]);

  // Inheritance resolver — replicates the backend walk so the UI shows the
  // effective state immediately without waiting for a tree reload.
  const resolve = useCallback(
    (path: string, isFolder: boolean): ResolvedConfig => {
      const direct = lookup.get(path);
      const childrenSource = (direct?.children_display_name_source as DisplayNameSource | null) ?? null;

      // Walk parents to detect hidden-by-parent visibility cascade.
      const parts = path.split('/').filter(Boolean);
      let hiddenByParent = false;
      let inheritedSource: DisplayNameSource | null = null;
      let inheritedFromPath: string | null = null;
      for (let i = parts.length - 1; i >= 1; i--) {
        const parentPath = parts.slice(0, i).join('/');
        const parent = lookup.get(parentPath) ?? lookup.get(`${parentPath}/`);
        if (!parent || !parent.is_folder) continue;
        if (!parent.is_visible) hiddenByParent = true;
        if (!inheritedSource && parent.children_display_name_source) {
          inheritedSource = parent.children_display_name_source as DisplayNameSource;
          inheritedFromPath = parentPath;
        }
      }

      // Folders: own source if explicit, otherwise filename.
      if (isFolder) {
        return {
          source: (direct?.display_name_source as DisplayNameSource) || DisplayNameSource.Filename,
          isInherited: !direct?.display_name_source,
          inheritedFrom: null,
          isVisible: direct?.is_visible ?? true,
          hiddenByParent,
          childrenSource,
        };
      }

      // Files: explicit > inherited from folder > space default.
      if (direct?.display_name_source) {
        return {
          source: direct.display_name_source as DisplayNameSource,
          isInherited: false,
          inheritedFrom: null,
          isVisible: direct.is_visible,
          hiddenByParent,
          childrenSource: null,
        };
      }

      if (inheritedSource) {
        return {
          source: inheritedSource,
          isInherited: true,
          inheritedFrom: inheritedFromPath,
          isVisible: direct?.is_visible ?? true,
          hiddenByParent,
          childrenSource: null,
        };
      }

      return {
        source: spaceDefaultSource,
        isInherited: true,
        inheritedFrom: 'space',
        isVisible: direct?.is_visible ?? true,
        hiddenByParent,
        childrenSource: null,
      };
    },
    [lookup, spaceDefaultSource],
  );

  // --- mutations ----------------------------------------------------------

  const upsertMapping = useCallback(
    (
      node: TreeNode,
      current: FileMapping | undefined,
      patch: {
        is_visible?: boolean;
        display_name?: string | null;
        display_name_source?: DisplayNameSource | null;
        children_display_name_source?: DisplayNameSource | null;
      },
    ) => {
      const isFolder = isFolderPath(node);
      const base = {
        file_path: node.path,
        is_folder: isFolder,
        is_visible: current?.is_visible ?? true,
        display_name: current?.display_name ?? null,
        display_name_source: (current?.display_name_source as DisplayNameSource | null) ?? null,
        children_display_name_source:
          (current?.children_display_name_source as DisplayNameSource | null) ?? null,
        ...patch,
      };
      if (current) {
        updateFileMapping(spaceSlug, current.id, base);
      } else {
        createFileMapping(spaceSlug, base);
      }
    },
    [spaceSlug],
  );

  const handleToggleVisibility = useCallback(
    (node: TreeNode, currentVisible: boolean) => {
      upsertMapping(node, lookup.get(node.path), { is_visible: !currentVisible });
    },
    [lookup, upsertMapping],
  );

  const handleChangeSource = useCallback(
    (node: TreeNode, source: DisplayNameSource | '') => {
      upsertMapping(node, lookup.get(node.path), {
        display_name_source: source ? (source as DisplayNameSource) : null,
      });
    },
    [lookup, upsertMapping],
  );

  const handleChangeChildrenSource = useCallback(
    (node: TreeNode, source: DisplayNameSource | '') => {
      upsertMapping(node, lookup.get(node.path), {
        children_display_name_source: source ? (source as DisplayNameSource) : null,
      });
    },
    [lookup, upsertMapping],
  );

  const handleSaveCustomName = useCallback(
    (node: TreeNode, customName: string) => {
      const trimmed = customName.trim();
      upsertMapping(node, lookup.get(node.path), {
        display_name: trimmed || null,
        display_name_source: DisplayNameSource.Custom,
      });
    },
    [lookup, upsertMapping],
  );

  // --- render -------------------------------------------------------------

  const renderRowExtras = useCallback(
    (node: TreeNode) => {
      const isFolder = isFolderPath(node);
      const resolved = resolve(node.path, isFolder);
      const direct = lookup.get(node.path);
      return (
        <FileMappingRowExtras
          node={node}
          mapping={direct}
          isFolder={isFolder}
          resolved={resolved}
          onToggleVisibility={handleToggleVisibility}
          onChangeSource={handleChangeSource}
          onChangeChildrenSource={handleChangeChildrenSource}
          onSaveCustomName={handleSaveCustomName}
        />
      );
    },
    [
      handleChangeChildrenSource,
      handleChangeSource,
      handleSaveCustomName,
      handleToggleVisibility,
      lookup,
      resolve,
    ],
  );

  // Wrap FileTree with a sticky column-header strip and a row-dim hook so
  // hidden rows are visually muted in the config panel.
  return (
    <div className="text-foreground">
      <div className="sticky top-0 z-10 bg-muted/95 border-b border-border px-2 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-2">
        <span className="flex-1 min-w-0">{t('fileMappingConfigPanel.colFile')}</span>
        <span className="w-16 text-center">{t('fileMappingConfigPanel.colVisible')}</span>
        <span className="w-32">{t('fileMappingConfigPanel.colDisplayAs')}</span>
        <span className="w-40">{t('fileMappingConfigPanel.colStatus')}</span>
        <span className="w-40">{t('fileMappingConfigPanel.colForChildren')}</span>
      </div>
      <FileTree
        tree={tree}
        expandedPaths={expandedPaths}
        onToggleFolder={handleToggleFolder}
        renderRowExtras={renderRowExtras}
        useRawNames
        getRowClassName={(node) => {
          const resolved = resolve(node.path, isFolderPath(node));
          return !resolved.isVisible || resolved.hiddenByParent
            ? 'opacity-40'
            : '';
        }}
      />
    </div>
  );
}

interface FileMappingRowExtrasProps {
  node: TreeNode;
  mapping: FileMapping | undefined;
  isFolder: boolean;
  resolved: ResolvedConfig;
  onToggleVisibility: (node: TreeNode, currentVisible: boolean) => void;
  onChangeSource: (node: TreeNode, source: DisplayNameSource | '') => void;
  onChangeChildrenSource: (node: TreeNode, source: DisplayNameSource | '') => void;
  onSaveCustomName: (node: TreeNode, customName: string) => void;
}

function FileMappingRowExtras({
  node,
  mapping,
  isFolder,
  resolved,
  onToggleVisibility,
  onChangeSource,
  onChangeChildrenSource,
  onSaveCustomName,
}: FileMappingRowExtrasProps) {
  const { t } = useTranslation();
  const isVisible = resolved.isVisible;
  const isCustom = resolved.source === DisplayNameSource.Custom && !resolved.isInherited;

  // Selected value for the per-row source dropdown.
  // Files: empty means "inherit". Folders: always show concrete value
  // (filename | custom) because folders never inherit a display source.
  const dropdownValue: string = (mapping?.display_name_source as string | null) ?? (isFolder ? 'filename' : '');

  const fileOptions = isFolder ? FOLDER_SOURCE_OPTIONS : FILE_SOURCE_OPTIONS;

  // Local draft for the custom-name input so typing doesn't fire an update
  // per keystroke. Reset whenever the upstream value changes.
  const [customDraft, setCustomDraft] = useState<string>(mapping?.display_name ?? '');
  useEffect(() => {
    setCustomDraft(mapping?.display_name ?? '');
  }, [mapping?.display_name]);

  const sourceLabel = (s: string) => {
    switch (s) {
      case 'first_h1': return 'H1';
      case 'first_h2': return 'H2';
      case 'title_frontmatter': return 'Frontmatter';
      case 'filename': return 'Filename';
      case 'custom': return 'Custom';
      default: return s.toUpperCase();
    }
  };

  return (
    <div className="flex items-center gap-2 ml-2">
      <label
        className="flex items-center justify-center w-16"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isVisible}
          disabled={resolved.hiddenByParent}
          onChange={(e) => {
            e.stopPropagation();
            onToggleVisibility(node, isVisible);
          }}
          onClick={(e) => e.stopPropagation()}
          title={
            resolved.hiddenByParent
              ? t('fileMappingConfigPanel.hiddenByParent')
              : t('fileMappingConfigPanel.visible')
          }
        />
      </label>

      <select
        value={dropdownValue}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChangeSource(node, e.target.value as DisplayNameSource | '')}
        className="w-32 px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground"
      >
        {fileOptions.map((opt) => (
          <option key={opt.value || 'inherit'} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>

      <div className="w-40 text-xs">
        {resolved.isInherited ? (
          <span
            className="text-muted-foreground italic"
            title={
              resolved.inheritedFrom === 'space'
                ? t('fileMappingConfigPanel.inheritedFromSpace')
                : t('fileMappingConfigPanel.inheritedFromParentTitle', { path: resolved.inheritedFrom ?? '' })
            }
          >
            {t(
              resolved.inheritedFrom === 'space'
                ? 'fileMappingConfigPanel.statusFromSpace'
                : 'fileMappingConfigPanel.statusFromParent',
              { source: sourceLabel(resolved.source) },
            )}
          </span>
        ) : (
          <span className="text-blue-600 font-medium">{t('fileMappingConfigPanel.override')}</span>
        )}
      </div>

      <div className="w-40">
        {isFolder ? (
          <select
            value={(resolved.childrenSource as string | null) ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChangeChildrenSource(node, e.target.value as DisplayNameSource | '')}
            className="w-full px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground"
          >
            {CHILDREN_SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value || 'inherit'} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>

      {isCustom && (
        <input
          type="text"
          value={customDraft}
          placeholder={t('fileMappingConfigPanel.customNamePlaceholder')}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setCustomDraft(e.target.value)}
          onBlur={() => {
            if (customDraft !== (mapping?.display_name ?? '')) {
              onSaveCustomName(node, customDraft);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground w-40"
        />
      )}
    </div>
  );
}
