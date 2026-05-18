/**
 * FileMappingConfigPanel — per-file editor for visibility and display-name
 * source. Renders the space's tree and overlays controls per row.
 *
 * Per FR cpt-cyberwiki-fr-document-index / cpt-cyberwiki-fr-title-extraction.
 *
 * Mutates state via fileMappingActions; mappings come in as a prop so the
 * parent owns the data lifecycle.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@cyberfabric/react';
import { FileTree } from '@/app/components/file/FileTree';
import {
  createFileMapping,
  updateFileMapping,
} from '@/app/actions/fileMappingActions';
import {
  DisplayNameSource,
  TreeNodeType,
  type FileMapping,
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

interface FileMappingConfigPanelProps {
  spaceSlug: string;
  tree: TreeNode[];
  /** Mappings indexed by `file_path` (no trailing slash). */
  mappings: Map<string, FileMapping>;
}

export function FileMappingConfigPanel({
  spaceSlug,
  tree,
  mappings,
}: FileMappingConfigPanelProps) {
  const isFolderPath = (node: TreeNode) => node.type === TreeNodeType.Dir;

  const handleToggleVisibility = useCallback(
    (node: TreeNode, currentVisible: boolean) => {
      const mapping = mappings.get(node.path);
      const isFolder = isFolderPath(node);
      if (mapping) {
        updateFileMapping(spaceSlug, mapping.id, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: !currentVisible,
          display_name: mapping.display_name ?? undefined,
          display_name_source: mapping.display_name_source,
        });
      } else {
        createFileMapping(spaceSlug, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: !currentVisible,
          display_name_source: null,
        });
      }
    },
    [mappings, spaceSlug],
  );

  const handleChangeSource = useCallback(
    (node: TreeNode, source: DisplayNameSource | '') => {
      const mapping = mappings.get(node.path);
      const isFolder = isFolderPath(node);

      if (!source) {
        // Empty = inherit; drop explicit mapping (unless we need to keep
        // visibility override / custom display_name). Simpler path: clear
        // source on existing mapping.
        if (mapping) {
          updateFileMapping(spaceSlug, mapping.id, {
            file_path: node.path,
            is_folder: isFolder,
            is_visible: mapping.is_visible,
            display_name: mapping.display_name ?? undefined,
            display_name_source: null,
          });
        }
        return;
      }

      if (mapping) {
        updateFileMapping(spaceSlug, mapping.id, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: mapping.is_visible,
          display_name: mapping.display_name ?? undefined,
          display_name_source: source,
        });
      } else {
        createFileMapping(spaceSlug, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: true,
          display_name_source: source,
        });
      }
    },
    [mappings, spaceSlug],
  );

  const handleSaveCustomName = useCallback(
    (node: TreeNode, customName: string) => {
      const mapping = mappings.get(node.path);
      const isFolder = isFolderPath(node);
      const trimmed = customName.trim();
      if (mapping) {
        updateFileMapping(spaceSlug, mapping.id, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: mapping.is_visible,
          display_name: trimmed || null,
          display_name_source: DisplayNameSource.Custom,
        });
      } else {
        createFileMapping(spaceSlug, {
          file_path: node.path,
          is_folder: isFolder,
          is_visible: true,
          display_name: trimmed || null,
          display_name_source: DisplayNameSource.Custom,
        });
      }
    },
    [mappings, spaceSlug],
  );

  const renderRowExtras = useCallback(
    (node: TreeNode) => (
      <FileMappingRowExtras
        node={node}
        mapping={mappings.get(node.path)}
        isFolder={isFolderPath(node)}
        onToggleVisibility={handleToggleVisibility}
        onChangeSource={handleChangeSource}
        onSaveCustomName={handleSaveCustomName}
      />
    ),
    [handleChangeSource, handleSaveCustomName, handleToggleVisibility, mappings],
  );

  return <FileTree tree={tree} renderRowExtras={renderRowExtras} useRawNames />;
}

interface FileMappingRowExtrasProps {
  node: TreeNode;
  mapping: FileMapping | undefined;
  isFolder: boolean;
  onToggleVisibility: (node: TreeNode, currentVisible: boolean) => void;
  onChangeSource: (node: TreeNode, source: DisplayNameSource | '') => void;
  onSaveCustomName: (node: TreeNode, customName: string) => void;
}

function FileMappingRowExtras({
  node,
  mapping,
  isFolder,
  onToggleVisibility,
  onChangeSource,
  onSaveCustomName,
}: FileMappingRowExtrasProps) {
  const { t } = useTranslation();
  const isVisible = mapping?.is_visible ?? true;
  const currentSource = mapping?.display_name_source ?? '';
  const isCustom = currentSource === DisplayNameSource.Custom;

  // Local input state so the user can type without firing an update per keystroke.
  // Reset whenever the upstream mapping value changes (e.g. after a successful save).
  const [customDraft, setCustomDraft] = useState<string>(mapping?.display_name ?? '');
  useEffect(() => {
    setCustomDraft(mapping?.display_name ?? '');
  }, [mapping?.display_name]);

  return (
    <div className="flex items-center gap-2 ml-2">
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={isVisible}
          onChange={(e) => {
            e.stopPropagation();
            onToggleVisibility(node, isVisible);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {t('fileMappingConfigPanel.visible')}
      </label>

      {!isFolder && (
        <>
          <select
            value={currentSource}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChangeSource(node, e.target.value as DisplayNameSource | '')}
            className="px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground"
          >
            {FILE_SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value || 'inherit'} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>

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
        </>
      )}

      {mapping?.is_override && (
        <span className="text-xs text-blue-600 font-medium">{t('fileMappingConfigPanel.override')}</span>
      )}
    </div>
  );
}
